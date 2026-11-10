import sqlite3 from "sqlite3";
import { createClient } from "@libsql/client";
import path from "node:path";

type Row = Record<string, unknown>;

const sourcePath = path.resolve(process.argv[2] ?? "data.db");
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before running the migration.");
}

const source = new sqlite3.Database(sourcePath, sqlite3.OPEN_READONLY);
const target = createClient({ url, authToken });

function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    source.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows as T[]));
  });
}

function quote(identifier: string): string {
  return '"' + identifier.replace(/"/g, '""') + '"';
}

async function main() {
  const objects = await all<{ type: string; name: string; sql: string | null }>(
    "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 WHEN 'view' THEN 3 ELSE 4 END, name"
  );
  const tables = objects.filter((item) => item.type === "table");

  console.log(`Found ${tables.length} tables in ${sourcePath}`);

  // Create the schema first. Existing destination tables are left intact;
  // this script is intended for an empty Turso database.
  for (const object of objects.filter((item) => item.type === "table")) {
    await target.execute(object.sql!);
  }

  let totalRows = 0;
  for (const table of tables) {
    const rows = await all<Row>(`SELECT * FROM ${quote(table.name)}`);
    if (!rows.length) {
      console.log(`  ${table.name}: 0 rows`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const insertSql = `INSERT INTO ${quote(table.name)} (${columns.map(quote).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;

    // Small batches avoid oversized requests and keep the script resumable
    // only after clearing/recreating the destination database.
    for (let offset = 0; offset < rows.length; offset += 50) {
      const batch = rows.slice(offset, offset + 50).map((row) => ({
        sql: insertSql,
        args: columns.map((column) => row[column] as never),
      }));
      await target.batch(batch, "write");
    }

    totalRows += rows.length;
    console.log(`  ${table.name}: ${rows.length} rows copied`);
  }

  // Recreate indexes, triggers and views after the table data is present.
  for (const object of objects.filter((item) => item.type !== "table")) {
    await target.execute(object.sql!);
  }

  console.log(`Migration finished. Copied ${totalRows} rows across ${tables.length} tables.`);
  console.log("Verify row counts and application behavior before switching production traffic.");
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await target.close();
    source.close();
  });
