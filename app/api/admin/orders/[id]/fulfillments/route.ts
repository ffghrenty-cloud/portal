import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";
import { advanceOrderWorkflow, notifyOrderCustomer } from "@/lib/order-automation";
import { consumeOrderReservation, ensureLegacyOrderReservations } from "@/lib/orders/stock-reservations";

async function currentActor() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return null;
  return new Promise<any>((resolve) => db.get(
    "SELECT id, role FROM users WHERE id = ?",
    [id],
    (err, user) => resolve(err ? null : user || null)
  ));
}
const run = (sql: string, params: any[] = []) => new Promise<any>((resolve, reject) => db.run(sql, params, function (err) { if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes }); }));
const get = (sql: string, params: any[] = []) => new Promise<any>((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor || actor.role !== "admin") return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  return new Promise<NextResponse>((resolve) => db.all(
    `SELECT f.id, f.status, f.tracking_carrier, f.tracking_number, f.note, f.created_at, f.shipped_at,
            fi.quantity, oi.product_name, oi.id AS order_item_id
     FROM order_fulfillments f
     JOIN order_fulfillment_items fi ON fi.fulfillment_id = f.id
     JOIN order_items oi ON oi.id = fi.order_item_id
     WHERE f.order_id = ? ORDER BY f.created_at ASC, fi.id ASC`,
    [id],
    (err, rows: any[]) => {
      if (err) return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      const map = new Map<number, any>();
      for (const row of rows || []) {
        if (!map.has(row.id)) map.set(row.id, { id: row.id, status: row.status, carrier: row.tracking_carrier, trackingNumber: row.tracking_number, note: row.note, createdAt: row.created_at, shippedAt: row.shipped_at, items: [] });
        map.get(row.id).items.push({ orderItemId: row.order_item_id, name: row.product_name, quantity: row.quantity });
      }
      resolve(NextResponse.json({ fulfillments: Array.from(map.values()) }));
    }
  ));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor || !["admin", "logistics"].includes(actor.role)) return NextResponse.json({ error: "Оформлять отправления может администратор или сотрудник логистики" }, { status: 403 });
  const { id } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ error: "Укажите хотя бы одну позицию для отгрузки" }, { status: 400 });
  const carrier = typeof body.carrier === "string" ? body.carrier.trim().slice(0, 100) : "";
  const trackingNumber = typeof body.trackingNumber === "string" ? body.trackingNumber.trim().slice(0, 120) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const actorId = Number(actor.id);

  const preOrder: any = await get("SELECT id, status FROM orders WHERE id = ?", [id]).catch(() => null);
  if (!preOrder) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  if (!["ready", "partially_shipped"].includes(preOrder.status)) {
    return NextResponse.json({ error: "Отгрузка доступна только для подготовленного заказа" }, { status: 409 });
  }
  if (actor.role === "logistics") {
    const assignedTask = await get(
      "SELECT id FROM order_stage_tasks WHERE order_id = ? AND stage = 'shipping' AND assigned_user_id = ? AND status = 'in_progress'",
      [id, actorId]
    );
    if (!assignedTask) return NextResponse.json({ error: "Заказ не назначен вам в рабочей очереди логистики" }, { status: 403 });
  }
  try {
    await ensureLegacyOrderReservations(Number(id));
  } catch (reservationError: any) {
    return NextResponse.json({ error: reservationError.message || "Не удалось проверить резерв товара" }, { status: 409 });
  }

  return new Promise<NextResponse>((resolve) => {
    db.serialize(async () => {
      try {
        await run("BEGIN IMMEDIATE");
        await run("CREATE TABLE IF NOT EXISTS stock_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, movement_type TEXT NOT NULL, quantity INTEGER NOT NULL, balance_after INTEGER NOT NULL, note TEXT, created_by INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (product_id) REFERENCES products(id), FOREIGN KEY (created_by) REFERENCES users(id))");
        const order = await get("SELECT id, user_id, status FROM orders WHERE id = ?", [id]);
        if (!order) throw new Error("Заказ не найден");
        if (actor.role === "logistics") {
          const assignedTask = await get(
            "SELECT id FROM order_stage_tasks WHERE order_id = ? AND stage = 'shipping' AND assigned_user_id = ? AND status = 'in_progress'",
            [id, actorId]
          );
          if (!assignedTask) throw new Error("Заказ не назначен вам в рабочей очереди логистики");
        }
        if (["cancelled", "delivered", "shipped"].includes(order.status)) throw new Error("Нельзя добавить отправление: заказ уже полностью отгружен, доставлен или отменён");
        if (!["ready", "partially_shipped"].includes(order.status)) throw new Error("Отгрузка доступна после того, как сотрудник подготовки отметит заказ загруженным и готовым к отправке");

        const requested = new Map<number, number>();
        for (const item of items) {
          const itemId = Number(item.orderItemId), qty = Number(item.quantity);
          if (!Number.isInteger(itemId) || itemId < 1 || !Number.isInteger(qty) || qty < 1) throw new Error("Количество для отгрузки должно быть целым числом больше нуля");
          requested.set(itemId, (requested.get(itemId) || 0) + qty);
        }
        const orderLines: any[] = await new Promise((res, rej) => db.all(
          `SELECT oi.id, oi.product_id, oi.quantity, oi.available_quantity, p.stock_quantity,
             COALESCE((SELECT SUM(fi.quantity) FROM order_fulfillment_items fi JOIN order_fulfillments f ON f.id = fi.fulfillment_id WHERE fi.order_item_id = oi.id AND f.status = 'shipped'), 0) AS shipped_quantity,
             COALESCE((SELECT SUM(r.quantity - r.consumed_quantity - r.released_quantity) FROM order_item_reservations r WHERE r.order_item_id = oi.id AND r.status = 'active'), 0) AS reserved_quantity
           FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
          [id], (err, rows) => err ? rej(err) : res(rows || [])
        ));
        if (!orderLines.length) throw new Error("В заказе нет позиций для отгрузки");
        const stockBalances = new Map<number, number>();
        for (const [itemId, qty] of requested) {
          const line = orderLines.find(row => Number(row.id) === itemId);
          if (!line) throw new Error("Позиция не относится к этому заказу");
          const remaining = Number(line.quantity) - Number(line.shipped_quantity);
          const checkedAvailable = Math.min(
            Math.max(0, Number(line.reserved_quantity || 0)),
            Math.max(0, Number(line.stock_quantity))
          );
          if (qty > remaining) throw new Error("Нельзя отгрузить больше, чем осталось по заказу");
          if (qty > checkedAvailable) throw new Error(`По позиции №${itemId} склад подтвердил только ${Math.max(0, checkedAvailable)} шт. доступных к отгрузке`);
          if (qty > Number(line.stock_quantity)) throw new Error("На текущем складе недостаточно товара для этой отгрузки");
        }

        const fulfillment = await run(
          "INSERT INTO order_fulfillments (order_id, status, tracking_carrier, tracking_number, note, created_by, shipped_at) VALUES (?, 'shipped', ?, ?, ?, ?, CURRENT_TIMESTAMP)",
          [id, carrier || null, trackingNumber || null, note || null, actorId]
        );
        for (const [itemId, qty] of requested) {
          const line = orderLines.find(row => Number(row.id) === itemId);
          await run("INSERT INTO order_fulfillment_items (fulfillment_id, order_item_id, quantity) VALUES (?, ?, ?)", [fulfillment.lastID, itemId, qty]);
          const stock = await run("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?", [qty, line.product_id, qty]);
          if (!stock.changes) throw new Error("Остаток товара изменился. Обновите страницу и повторите отгрузку");
          const productId = Number(line.product_id);
          const previousBalance = stockBalances.get(productId) ?? Number(line.stock_quantity);
          const nextBalance = previousBalance - qty;
          stockBalances.set(productId, nextBalance);
          await run(
            "INSERT INTO stock_movements (product_id, movement_type, quantity, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?)",
            [line.product_id, "shipment", -qty, nextBalance, "Отгрузка №" + fulfillment.lastID + " по заказу №" + id, actorId]
          );
          await consumeOrderReservation(itemId, qty);
        }

        const allLines = await new Promise<any[]>((res, rej) => db.all(
          `SELECT oi.quantity, COALESCE((SELECT SUM(fi.quantity) FROM order_fulfillment_items fi JOIN order_fulfillments f ON f.id = fi.fulfillment_id WHERE fi.order_item_id = oi.id AND f.status = 'shipped'), 0) AS shipped_quantity
           FROM order_items oi WHERE oi.order_id = ?`,
          [id], (err, rows) => err ? rej(err) : res(rows || [])
        ));
        const allShipped = allLines.length > 0 && allLines.every(line => Number(line.shipped_quantity) >= Number(line.quantity));
        const newStatus = allShipped ? "shipped" : "partially_shipped";
        await run("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [newStatus, id]);
        await run(
          "INSERT INTO order_events (order_id, status, title, description, actor_user_id) VALUES (?, ?, ?, ?, ?)",
          [id, newStatus, allShipped ? "Заказ отгружен полностью" : "Часть заказа отгружена", `Создано отправление №${fulfillment.lastID}. Отгружено позиций: ${requested.size}.`, actorId]
        );

        if (allShipped) {
          await run(
            "UPDATE order_stage_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP, note = ? WHERE order_id = ? AND stage = 'shipping' AND status != 'completed'",
            [`Все позиции переданы в доставку. Последнее отправление №${fulfillment.lastID}.`, id]
          );
        } else {
          await run(
            "UPDATE order_stage_tasks SET status = 'in_progress', note = ? WHERE order_id = ? AND stage = 'shipping' AND status = 'pending'",
            [`Частичное отправление №${fulfillment.lastID} оформлено. Ожидается отгрузка остатка.`, id]
          );
        }
        await run("COMMIT");

        if (allShipped) {
          await advanceOrderWorkflow(Number(id), "shipping", actorId);
        } else {
          void notifyOrderCustomer(Number(id), "Часть заказа отправлена", "Часть заказа передана в доставку. Остальные позиции останутся в работе и будут отправлены отдельно.");
        }
        resolve(NextResponse.json({ ok: true, fulfillmentId: fulfillment.lastID, status: newStatus, allShipped }, { status: 201 }));
      } catch (err: any) {
        await run("ROLLBACK").catch(() => {});
        resolve(NextResponse.json({ error: err.message || "Не удалось оформить отправление" }, { status: err.message === "Заказ не найден" ? 404 : 400 }));
      }
    });
  });
}
