import db from './db';

export function seedProducts(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as c FROM products', (err, row: any) => {
      if (err) return reject(err);

      if (row.c > 0) {
        console.log('Товары уже есть');
        return resolve();
      }

      const stmt = db.prepare(`
        INSERT INTO products (name, sku, category, price, description)
        VALUES (?, ?, ?, ?, ?)
      `);

      const products = [
        ['Простыня лён натуральный', 'SKU-001', 'Постельное бельё', 50, 'Простыня из 100% льна'],
        ['Набор постельного белья', 'SKU-002', 'Постельное бельё', 150, 'Комплект: простыня, наволочки'],
        ['Полотенце льняное', 'SKU-003', 'Полотенца', 20, 'Мягкое льняное полотенце'],
        ['Скатерть льняная', 'SKU-004', 'Скатерти', 80, 'Скатерть из льна'],
        ['Рубашка льняная', 'SKU-005', 'Одежда', 120, 'Мужская рубашка из льна'],
        ['Платье льняное', 'SKU-006', 'Одежда', 140, 'Женское платье из льна'],
      ];

      let completed = 0;
      for (const p of products) {
        stmt.run(p, (err) => {
          if (err) return reject(err);
          completed++;
          if (completed === products.length) {
            console.log(`✅ Добавлено ${products.length} товаров`);
            stmt.finalize();
            resolve();
          }
        });
      }
    });
  });
}