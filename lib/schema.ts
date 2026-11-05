import db from './db';

export function initDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'client',
        company TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sku TEXT UNIQUE,
        category TEXT,
        price REAL NOT NULL,
        description TEXT,
        image_url TEXT
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        total REAL NOT NULL,
        contact_name TEXT,
        contact_phone TEXT,
        address TEXT,
        comment TEXT,
        manager TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS order_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_order_notifications_user ON order_notifications(user_id, is_read, created_at);

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );

      CREATE TABLE IF NOT EXISTS order_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        actor_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (actor_user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS order_stage_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        stage TEXT NOT NULL,
        assigned_user_id INTEGER,
        assigned_by_user_id INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (assigned_user_id) REFERENCES users(id),
        FOREIGN KEY (assigned_by_user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS order_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        admin_reply TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        replied_at DATETIME,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS order_fulfillments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'prepared',
        tracking_carrier TEXT,
        tracking_number TEXT,
        note TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        shipped_at DATETIME,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS order_fulfillment_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fulfillment_id INTEGER NOT NULL,
        order_item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        FOREIGN KEY (fulfillment_id) REFERENCES order_fulfillments(id),
        FOREIGN KEY (order_item_id) REFERENCES order_items(id),
        UNIQUE (fulfillment_id, order_item_id)
      );

      CREATE INDEX IF NOT EXISTS idx_order_fulfillments_order ON order_fulfillments(order_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_order_reviews_user ON order_reviews(user_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
      CREATE INDEX IF NOT EXISTS idx_order_tasks_assignee ON order_stage_tasks(assigned_user_id, status);

      CREATE TABLE IF NOT EXISTS admin_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        is_from_admin INTEGER DEFAULT 0,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `, (err) => {
      if (err) reject(err);
      else {
        const migrations = [
          "ALTER TABLE orders ADD COLUMN tracking_carrier TEXT",
          "ALTER TABLE orders ADD COLUMN tracking_number TEXT",
          "ALTER TABLE orders ADD COLUMN estimated_delivery TEXT",
          "ALTER TABLE users ADD COLUMN discount_percent REAL NOT NULL DEFAULT 0",
          "ALTER TABLE users ADD COLUMN discount_valid_until TEXT",
          "ALTER TABLE products ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0",
          "ALTER TABLE orders ADD COLUMN subtotal REAL NOT NULL DEFAULT 0",
          "ALTER TABLE orders ADD COLUMN discount_percent REAL NOT NULL DEFAULT 0",
          "ALTER TABLE orders ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0",
          "ALTER TABLE orders ADD COLUMN stock_checked_by INTEGER",
          "ALTER TABLE orders ADD COLUMN stock_checked_at DATETIME",
          "ALTER TABLE order_items ADD COLUMN available_quantity INTEGER",
          "ALTER TABLE order_items ADD COLUMN warehouse_note TEXT"
        ];
        const runMigration = (index: number) => {
          if (index >= migrations.length) {
            console.log('✅ Таблицы и миграции созданы');
            resolve();
            return;
          }
          db.run(migrations[index], (migrationError) => {
            if (migrationError && !migrationError.message.includes("duplicate column name")) {
              reject(migrationError);
              return;
            }
            runMigration(index + 1);
          });
        };
        runMigration(0);
      }
    });
  });
}