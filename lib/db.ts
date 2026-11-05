import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err);
  } else {
    console.log('✅ Подключено к SQLite');
  }
});

// Безопасная инициализация новых таблиц: CREATE IF NOT EXISTS не удаляет
// существующие данные и не пересоздаёт локальную базу.
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS order_stage_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      stage TEXT NOT NULL,
      assigned_user_id INTEGER NOT NULL,
      assigned_by_user_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_by_user_id) REFERENCES users(id)
    )
  `, (schemaError) => {
    if (schemaError) {
      console.error('Ошибка инициализации очереди заданий:', schemaError.message);
    } else {
      db.run(
        'CREATE INDEX IF NOT EXISTS idx_order_stage_tasks_assignee_status ON order_stage_tasks(assigned_user_id, status, stage)',
        (indexError) => {
          if (indexError) console.error('Ошибка индекса очереди заданий:', indexError.message);
          else console.log('✅ Схема очереди заданий проверена');
        }
      );
    }
  });
});

export default db;
