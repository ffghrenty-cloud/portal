import sqlite3 from "sqlite3";
import { createClient } from "@libsql/client";
import path from "node:path";

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

const source = new sqlite3.Database(sourcePath, sqlite3.OPEN_READONLY);
const target = createClient({ url, authToken });

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    source.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });
}
function quote(identifier) {
  return '"' + identifier.replace(/"/g, '""') + '"';
}

async function main() {
  const existing = await target.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1"
  );
  if (existing.rows.length) {
    throw new Error(`База Turso не пустая (найдена таблица ${existing.rows[0].name}). Перенос остановлен без изменения данных.`);
  }

  const objects = await all(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 WHEN 'view' THEN 3 ELSE 4 END, name"
  );
  const tables = objects.filter((item) => item.type === "table");
  if (!tables.length) throw new Error("В исходной SQLite-базе не найдено таблиц.");

  console.log(`Источник: ${sourcePath}`);
  console.log(`Таблиц для переноса: ${tables.length}`);
  console.log("Проверка Turso: база пустая.");

  // Сначала создаём структуру, затем переносим данные без проверки FK,
  // поскольку порядок таблиц может отличаться от порядка зависимостей.
  await target.execute("PRAGMA foreign_keys = OFF");
  for (const table of tables) await target.execute(table.sql);

  let totalRows = 0;
  const expectedCounts = new Map();
  for (const table of tables) {
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
        await target.batch(batch, "write");
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
      const update = await target.execute({
        sql: "UPDATE sqlite_sequence SET seq = CASE WHEN seq < ? THEN ? ELSE seq END WHERE name = ?",
        args: [sequence.seq, sequence.seq, sequence.name],
      });
      if (Number(update.rowsAffected) === 0) {
        await target.execute({
          sql: "INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)",
          args: [sequence.name, sequence.seq],
        });
      }
    }
  } catch (error) {
    if (!String(error?.message || error).includes("no such table")) throw error;
  }

  for (const object of objects.filter((item) => item.type !== "table")) {
    await target.execute(object.sql);
  }

  await target.execute("PRAGMA foreign_keys = ON");
  const foreignKeyErrors = await target.execute("PRAGMA foreign_key_check");
  if (foreignKeyErrors.rows.length) {
    throw new Error(`Проверка внешних ключей выявила ошибки: ${JSON.stringify(foreignKeyErrors.rows.slice(0, 10))}`);
  }

  for (const table of tables) {
    const actual = await target.execute(`SELECT COUNT(*) AS count FROM ${quote(table.name)}`);
    const count = Number(actual.rows[0]?.count ?? 0);
    const expected = expectedCounts.get(table.name);
    if (count !== expected) {
      throw new Error(`Проверка количества строк не пройдена для ${table.name}: источник ${expected}, Turso ${count}`);
    }
  }

  console.log(`Перенос завершён: ${totalRows} строк в ${tables.length} таблицах.`);
  console.log("Количество строк сверено, проверка внешних ключей пройдена.");
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
