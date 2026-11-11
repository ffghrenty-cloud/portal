import { createClient } from "@libsql/client";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = path.resolve(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "data.db");
const confirmed = process.argv.includes("--confirm-empty-target");
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!confirmed) {
  throw new Error("Для защиты данных добавьте флаг --confirm-empty-target после проверки, что база Turso пустая.");
}
if (!url || !authToken) {
  throw new Error("Задайте TURSO_DATABASE_URL и TURSO_AUTH_TOKEN в переменных окружения.");
}

const source = createClient({ url: pathToFileURL(sourcePath).href });
const target = createClient({ url, authToken });

async function all(sql, params = []) {
  const result = await source.execute({ sql, args: params });
  return result.rows.map((row) =>
    Object.fromEntries(result.columns.map((column, index) => [column, row[index]]))
  );
}
function quote(identifier) {
  return '"' + identifier.replace(/"/g, '""') + '"';
}

async function main() {
  const existing = await target.execute(
    "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' LIMIT 1"
  );
  if (existing.rows.length) {
    throw new Error(`База Turso не пустая (найден объект ${existing.rows[0].type}: ${existing.rows[0].name}). Перенос остановлен без изменения данных.`);
  }

  const objects = await all(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 WHEN 'view' THEN 3 ELSE 4 END, name"
  );
  const tables = objects.filter((item) => item.type === "table");
  if (!tables.length) throw new Error("В исходной SQLite-базе не найдено таблиц.");

  console.log(`Источник: ${sourcePath}`);
  console.log(`Таблиц для переноса: ${tables.length}`);
  console.log("Проверка Turso: база пустая.");

  // Вся миграция выполняется одной транзакцией. При любой ошибке Turso
  // откатит DDL, данные, индексы и счётчики ID целиком.
  const tx = await target.transaction("write");
  try {
  // Сначала создаём все таблицы. Данные переносим в порядке зависимостей
  // внешних ключей: родительские таблицы должны быть заполнены раньше дочерних.
  for (const table of tables) await tx.execute(table.sql);

  const tableNames = new Set(tables.map((table) => table.name));
  const dependencies = new Map();
  for (const table of tables) {
    const foreignKeys = await all(`PRAGMA foreign_key_list(${quote(table.name)})`);
    dependencies.set(
      table.name,
      new Set(foreignKeys.map((key) => key.table).filter((name) => tableNames.has(name) && name !== table.name))
    );
  }

  const orderedTables = [];
  const copiedTables = new Set();
  while (orderedTables.length < tables.length) {
    const ready = tables.filter((table) =>
      !copiedTables.has(table.name) &&
      [...dependencies.get(table.name)].every((name) => copiedTables.has(name))
    );
    if (!ready.length) {
      throw new Error("Обнаружена циклическая зависимость внешних ключей. Автоматический перенос остановлен.");
    }
    for (const table of ready) {
      orderedTables.push(table);
      copiedTables.add(table.name);
    }
  }

  let totalRows = 0;
  const expectedCounts = new Map();
  for (const table of orderedTables) {
    const rows = await all(`SELECT * FROM ${quote(table.name)}`);
    expectedCounts.set(table.name, rows.length);
    if (rows.length) {
      const columns = Object.keys(rows[0]);
      const insertSql = `INSERT INTO ${quote(table.name)} (${columns.map(quote).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
      for (let offset = 0; offset < rows.length; offset += 50) {
        const batch = rows.slice(offset, offset + 50).map((row) => ({
          sql: insertSql,
          args: columns.map((column) => row[column] ?? null),
        }));
        for (const statement of batch) await tx.execute(statement);
      }
    }
    totalRows += rows.length;
    console.log(`  ${table.name}: ${rows.length} строк перенесено`);
  }

  // Восстанавливаем AUTOINCREMENT-счётчики, чтобы новые ID не пересекались
  // с ранее выданными, даже если максимальная запись была удалена.
  try {
    const sequences = await all("SELECT name, seq FROM sqlite_sequence");
    for (const sequence of sequences) {
      const update = await tx.execute({
        sql: "UPDATE sqlite_sequence SET seq = CASE WHEN seq < ? THEN ? ELSE seq END WHERE name = ?",
        args: [sequence.seq, sequence.seq, sequence.name],
      });
      if (Number(update.rowsAffected) === 0) {
        await tx.execute({
          sql: "INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)",
          args: [sequence.name, sequence.seq],
        });
      }
    }
  } catch (error) {
    if (!String(error?.message || error).includes("no such table")) throw error;
  }

  for (const object of objects.filter((item) => item.type !== "table")) {
    await tx.execute(object.sql);
  }

  const foreignKeyErrors = await tx.execute("PRAGMA foreign_key_check");
  if (foreignKeyErrors.rows.length) {
    throw new Error(`Проверка внешних ключей выявила ошибки: ${JSON.stringify(foreignKeyErrors.rows.slice(0, 10))}`);
  }

  for (const table of tables) {
    const actual = await tx.execute(`SELECT COUNT(*) AS count FROM ${quote(table.name)}`);
    const count = Number(actual.rows[0]?.count ?? 0);
    const expected = expectedCounts.get(table.name);
    if (count !== expected) {
      throw new Error(`Проверка количества строк не пройдена для ${table.name}: источник ${expected}, Turso ${count}`);
    }
  }

  await tx.commit();
  console.log(`Перенос завершён: ${totalRows} строк в ${tables.length} таблицах.`);
  console.log("Количество строк сверено, проверка внешних ключей пройдена.");
  } catch (error) {
    try { await tx.rollback(); } catch {}
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("Перенос не завершён:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await target.close();
    source.close();
  });
