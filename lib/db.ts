import { createClient, type Client, type Transaction } from "@libsql/client";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";

type SqlCallback = (error: Error | null, row?: any) => void;
type RunCallback = (this: { lastID: number; changes: number }, error: Error | null) => void;
type DbContext = { transaction?: Transaction; release?: () => void };

const databaseUrl =
  process.env.TURSO_DATABASE_URL ||
  (process.env.NODE_ENV === "production"
    ? ""
    : `file:${path.join(process.cwd(), "data.db")}`);

if (!databaseUrl) {
  throw new Error("Не задан TURSO_DATABASE_URL. Добавьте URL базы Turso в переменные окружения Vercel.");
}

const client: Client = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const contexts = new AsyncLocalStorage<DbContext>();

// Блокировка защищает транзакции: запросы из других HTTP-запросов не попадут
// внутрь уже открытой транзакции.
let lockTail: Promise<void> = Promise.resolve();

async function acquireLock(): Promise<() => void> {
  let release!: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  const previous = lockTail;
  lockTail = previous.then(() => next);
  await previous;
  return release;
}

function normalizeArgs(params?: any[] | Record<string, any>): any[] | Record<string, any> {
  if (params === undefined) return [];
  if (Array.isArray(params)) return params.map((value) => value === undefined ? null : value);
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, value === undefined ? null : value]));
}

async function execute(sql: string, params?: any[] | Record<string, any>) {
  const context = contexts.getStore();
  if (context?.transaction) {
    return context.transaction.execute({ sql, args: normalizeArgs(params) as any });
  }

  const release = await acquireLock();
  try {
    return await client.execute({ sql, args: normalizeArgs(params) as any });
  } finally {
    release();
  }
}

function parseRunArgs(paramsOrCallback?: any[] | RunCallback, callback?: RunCallback) {
  if (typeof paramsOrCallback === "function") return { params: [], callback: paramsOrCallback };
  return { params: paramsOrCallback || [], callback };
}

const db = {
  get(sql: string, paramsOrCallback?: any[] | SqlCallback, callback?: SqlCallback) {
    const params = typeof paramsOrCallback === "function" ? [] : paramsOrCallback || [];
    const done = typeof paramsOrCallback === "function" ? paramsOrCallback : callback;
    void execute(sql, params)
      .then((result) => done?.(null, result.rows[0] ?? undefined))
      .catch((error) => done?.(error as Error));
    return db;
  },

  all(sql: string, paramsOrCallback?: any[] | SqlCallback, callback?: SqlCallback) {
    const params = typeof paramsOrCallback === "function" ? [] : paramsOrCallback || [];
    const done = typeof paramsOrCallback === "function" ? paramsOrCallback : callback;
    void execute(sql, params)
      .then((result) => done?.(null, result.rows))
      .catch((error) => done?.(error as Error));
    return db;
  },

  run(sql: string, paramsOrCallback?: any[] | RunCallback, callback?: RunCallback) {
    const parsed = parseRunArgs(paramsOrCallback, callback);
    const normalizedSql = sql.trim().replace(/;$/, "").toUpperCase();
    const context = contexts.getStore();

    const operation = async () => {
      if (normalizedSql === "BEGIN" || normalizedSql === "BEGIN IMMEDIATE" || normalizedSql === "BEGIN TRANSACTION") {
        if (!context) throw new Error("Транзакцию необходимо открывать внутри db.serialize()");
        if (context.transaction) throw new Error("Вложенные транзакции не поддерживаются");
        context.release = await acquireLock();
        try {
          context.transaction = await client.transaction("write");
          return { lastInsertRowid: 0, rowsAffected: 0 };
        } catch (error) {
          context.release();
          context.release = undefined;
          throw error;
        }
      }

      if (normalizedSql === "COMMIT" || normalizedSql === "END" || normalizedSql === "COMMIT TRANSACTION") {
        if (!context?.transaction) throw new Error("Нет активной транзакции для COMMIT");
        try {
          await context.transaction.commit();
          return { lastInsertRowid: 0, rowsAffected: 0 };
        } finally {
          context.transaction = undefined;
          context.release?.();
          context.release = undefined;
        }
      }

      if (normalizedSql === "ROLLBACK" || normalizedSql === "ROLLBACK TRANSACTION") {
        if (!context?.transaction) return { lastInsertRowid: 0, rowsAffected: 0 };
        try {
          await context.transaction.rollback();
          return { lastInsertRowid: 0, rowsAffected: 0 };
        } finally {
          context.transaction = undefined;
          context.release?.();
          context.release = undefined;
        }
      }

      return execute(sql, parsed.params);
    };

    void operation()
      .then((result: any) => {
        const thisValue = {
          lastID: Number(result.lastInsertRowid ?? 0),
          changes: Number(result.rowsAffected ?? 0),
        };
        parsed.callback?.call(thisValue, null);
      })
      .catch((error) => parsed.callback?.call({ lastID: 0, changes: 0 }, error as Error));
    return db;
  },

  exec(sql: string, callback?: (error: Error | null) => void) {
    const statements = sql.split(";").map((part) => part.trim()).filter(Boolean);
    void (async () => {
      for (const statement of statements) await execute(statement);
    })().then(() => callback?.(null)).catch((error) => callback?.(error as Error));
    return db;
  },

  prepare(sql: string) {
    return {
      run(paramsOrCallback?: any[] | RunCallback, callback?: RunCallback) {
        const parsed = parseRunArgs(paramsOrCallback, callback);
        void execute(sql, parsed.params)
          .then((result: any) => parsed.callback?.call({
            lastID: Number(result.lastInsertRowid ?? 0),
            changes: Number(result.rowsAffected ?? 0),
          }, null))
          .catch((error) => parsed.callback?.call({ lastID: 0, changes: 0 }, error as Error));
        return this;
      },
      finalize(callback?: (error: Error | null) => void) {
        callback?.(null);
        return this;
      },
    };
  },

  serialize(callback: () => void) {
    const context: DbContext = {};
    contexts.run(context, callback);
    return db;
  },

  close(callback?: (error: Error | null) => void) {
    try {
      client.close();
      callback?.(null);
    } catch (error) {
      callback?.(error as Error);
    }
  },
};

export default db;
