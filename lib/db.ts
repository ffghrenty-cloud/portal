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
    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      actor_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_user_id) REFERENCES users(id)
    )
  `, (error) => { if (error) console.error('Ошибка инициализации истории заказов:', error.message); });

  db.run(`
    CREATE TABLE IF NOT EXISTS order_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (error) => { if (error) console.error('Ошибка инициализации уведомлений:', error.message); });

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      is_from_admin INTEGER NOT NULL DEFAULT 0,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (error) => { if (error) console.error('Ошибка инициализации переписки:', error.message); });

  db.run(`
    CREATE TABLE IF NOT EXISTS order_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      admin_reply TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      replied_at TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (error) => { if (error) console.error('Ошибка инициализации отзывов:', error.message); });

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
          if (indexError) {
            console.error('Ошибка индекса очереди заданий:', indexError.message);
            return;
          }
          console.log('✅ Схема очереди заданий проверена');

          // Подхватываем старые заказы, созданные до появления очереди заданий.
          // Повторный запуск безопасен: NOT EXISTS не создаёт дубликаты.
          db.run(`
            INSERT INTO order_stage_tasks (order_id, stage, assigned_user_id, status, note)
            SELECT o.id, 'stock_check',
                   (SELECT u.id FROM users u WHERE u.role = 'order_receiver' ORDER BY u.created_at ASC, u.id ASC LIMIT 1),
                   'pending', 'Назначено автоматически при обновлении системы'
            FROM orders o
            WHERE o.status = 'pending'
              AND EXISTS (SELECT 1 FROM users WHERE role = 'order_receiver')
              AND NOT EXISTS (
                SELECT 1 FROM order_stage_tasks t
                WHERE t.order_id = o.id AND t.stage = 'stock_check' AND t.status != 'cancelled'
              )
          `, (seedError) => {
            if (seedError) console.error('Ошибка восстановления очереди приёмщика:', seedError.message);
            db.run(`
              INSERT INTO order_stage_tasks (order_id, stage, assigned_user_id, status, note)
              SELECT o.id, 'manager_review',
                     (SELECT u.id FROM users u WHERE u.role IN ('manager', 'senior_manager') ORDER BY u.created_at ASC, u.id ASC LIMIT 1),
                     'pending', 'Назначено автоматически при обновлении системы'
              FROM orders o
              WHERE o.status = 'stock_checked'
                AND EXISTS (SELECT 1 FROM users WHERE role IN ('manager', 'senior_manager'))
                AND NOT EXISTS (
                  SELECT 1 FROM order_stage_tasks t
                  WHERE t.order_id = o.id AND t.stage = 'manager_review' AND t.status != 'cancelled'
                )
            `, (managerSeedError) => {
              if (managerSeedError) console.error('Ошибка восстановления очереди менеджера:', managerSeedError.message);
            });
          });
        }
      );
    }
  });
});

export default db;
