import db from "@/lib/db";

type Row = Record<string, any>;

const run = (sql: string, params: any[] = []) => new Promise<{ lastID: number; changes: number }>((resolve, reject) =>
  db.run(sql, params, function (error) {
    if (error) reject(error);
    else resolve({ lastID: this.lastID, changes: this.changes });
  })
);
const get = <T = Row>(sql: string, params: any[] = []) => new Promise<T | undefined>((resolve, reject) =>
  db.get(sql, params, (error, row) => error ? reject(error) : resolve(row as T | undefined))
);
const all = <T = Row>(sql: string, params: any[] = []) => new Promise<T[]>((resolve, reject) =>
  db.all(sql, params, (error, rows) => error ? reject(error) : resolve((rows || []) as T[]))
);

async function transaction<T>(work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    db.serialize(() => {
      void (async () => {
        try {
          await run("BEGIN IMMEDIATE");
          const result = await work();
          await run("COMMIT");
          resolve(result);
        } catch (error) {
          await run("ROLLBACK").catch(() => undefined);
          reject(error);
        }
      })();
    });
  });
}

/** Резервирует подтверждённое приёмщиком количество после согласования менеджером. */
export async function reserveOrderStock(orderId: number): Promise<void> {
  await transaction(async () => {
    const lines = await all<Row>(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.available_quantity, p.stock_quantity,
        COALESCE((SELECT SUM(r.quantity - r.consumed_quantity - r.released_quantity)
          FROM order_item_reservations r
          WHERE r.product_id = oi.product_id AND r.status = 'active'), 0) AS reserved_for_product,
        COALESCE((SELECT SUM(r.quantity - r.consumed_quantity - r.released_quantity)
          FROM order_item_reservations r
          WHERE r.order_item_id = oi.id AND r.status = 'active'), 0) AS reserved_for_line
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ? ORDER BY oi.id`,
      [orderId]
    );
    if (!lines.length) throw new Error("В заказе нет товарных позиций");
    if (lines.some((line) => line.available_quantity === null || line.available_quantity === undefined)) {
      throw new Error("Сначала приёмщик должен проверить наличие по всем позициям");
    }
    if (!lines.some((line) => Number(line.available_quantity) > 0)) {
      throw new Error("Нельзя согласовать заказ: на складе нет ни одной доступной позиции");
    }

    const reservedByProduct = new Map<number, number>();
    for (const line of lines) {
      const productId = Number(line.product_id);
      const requested = Number(line.available_quantity);
      if (!Number.isInteger(requested) || requested < 0 || requested > Number(line.quantity)) {
        throw new Error("Некорректное подтверждённое количество товара");
      }
      const existing = Number(line.reserved_for_line || 0);
      if (existing > 0) {
        if (existing !== requested) throw new Error("Для заказа уже существует резерв с другим количеством");
        continue;
      }
      if (requested === 0) continue;
      const alreadyCounted = reservedByProduct.get(productId) ?? 0;
      const free = Number(line.stock_quantity || 0) - Number(line.reserved_for_product || 0) - alreadyCounted;
      if (requested > free) {
        throw new Error(`Недостаточно свободного остатка для позиции «${line.id}»: доступно ${Math.max(0, free)} шт.`);
      }
      await run(
        "INSERT INTO order_item_reservations (order_item_id, product_id, quantity) VALUES (?, ?, ?)",
        [line.id, line.product_id, requested]
      );
      reservedByProduct.set(productId, alreadyCounted + requested);
    }
  });
}

/** Совместимость с заказами, согласованными до внедрения резервирования. */
export async function ensureLegacyOrderReservations(orderId: number): Promise<void> {
  await transaction(async () => {
    const lines = await all<Row>(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.available_quantity, p.stock_quantity,
        COALESCE((SELECT SUM(fi.quantity) FROM order_fulfillment_items fi
          JOIN order_fulfillments f ON f.id = fi.fulfillment_id
          WHERE fi.order_item_id = oi.id AND f.status = 'shipped'), 0) AS shipped_quantity,
        COALESCE((SELECT SUM(r.quantity - r.consumed_quantity - r.released_quantity)
          FROM order_item_reservations r WHERE r.order_item_id = oi.id AND r.status = 'active'), 0) AS reserved_for_line,
        COALESCE((SELECT SUM(r.quantity - r.consumed_quantity - r.released_quantity)
          FROM order_item_reservations r WHERE r.product_id = oi.product_id AND r.status = 'active'), 0) AS reserved_for_product
       FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
      [orderId]
    );
    const reservedByProduct = new Map<number, number>();
    for (const line of lines) {
      const productId = Number(line.product_id);
      const alreadyReserved = Number(line.reserved_for_line || 0);
      const remainingApproved = Math.max(0, Number(line.available_quantity || 0) - Number(line.shipped_quantity || 0));
      const missing = remainingApproved - alreadyReserved;
      if (missing <= 0) continue;
      const alreadyCounted = reservedByProduct.get(productId) ?? 0;
      const free = Number(line.stock_quantity || 0) - Number(line.reserved_for_product || 0) - alreadyCounted;
      if (missing > free) throw new Error("Недостаточно свободного остатка для продолжения отгрузки старого заказа");
      await run(
        "INSERT INTO order_item_reservations (order_item_id, product_id, quantity) VALUES (?, ?, ?)",
        [line.id, line.product_id, missing]
      );
      reservedByProduct.set(productId, alreadyCounted + missing);
    }
  });
}

/** Переводит зарезервированное количество в фактически отгруженное. */
export async function consumeOrderReservation(orderItemId: number, quantity: number): Promise<void> {
    const reservations = await all<Row>(
      "SELECT id, quantity, consumed_quantity, released_quantity FROM order_item_reservations WHERE order_item_id = ? AND status = 'active' ORDER BY id",
      [orderItemId]
    );
    let remaining = quantity;
    for (const reservation of reservations) {
      if (remaining <= 0) break;
      const available = Number(reservation.quantity) - Number(reservation.consumed_quantity) - Number(reservation.released_quantity);
      const consume = Math.min(available, remaining);
      if (consume <= 0) continue;
      await run(
        `UPDATE order_item_reservations
         SET consumed_quantity = consumed_quantity + ?,
             status = CASE WHEN consumed_quantity + ? + released_quantity >= quantity THEN 'consumed' ELSE 'active' END,
             consumed_at = CASE WHEN consumed_quantity + ? + released_quantity >= quantity THEN CURRENT_TIMESTAMP ELSE consumed_at END
         WHERE id = ?`,
        [consume, consume, consume, reservation.id]
      );
      remaining -= consume;
    }
    if (remaining > 0) throw new Error("Недостаточно зарезервированного товара для отгрузки");
}

/** Освобождает только неотгруженную часть резерва. */
export async function releaseOrderReservations(orderId: number): Promise<void> {
  await transaction(async () => {
    await run(
      `UPDATE order_item_reservations
       SET released_quantity = quantity - consumed_quantity,
           status = 'released', released_at = CURRENT_TIMESTAMP
       WHERE status = 'active' AND order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)`,
      [orderId]
    );
  });
}
