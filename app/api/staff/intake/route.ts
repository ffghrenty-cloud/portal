import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";
import { advanceOrderWorkflow } from "@/lib/order-automation";

async function currentUser() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return null;
  return new Promise<any>((resolve) => db.get("SELECT id, role FROM users WHERE id = ?", [id], (err, row) => resolve(err ? null : row || null)));
}

export async function GET() {
  const actor = await currentUser();
  if (!actor || actor.role !== "order_receiver") return NextResponse.json({ error: "Доступ разрешён только приёмщику заказов" }, { status: 403 });
  return new Promise<NextResponse>((resolve) => db.all(
    `SELECT o.id AS order_id, o.total, o.created_at, o.contact_name, o.contact_phone, o.address,
            u.email AS customer_email, u.company AS customer_company,
            t.id AS task_id, t.status AS task_status, oi.id AS order_item_id, oi.product_id, oi.product_name,
            oi.quantity AS ordered_quantity, oi.available_quantity, oi.warehouse_note,
            p.stock_quantity, p.sku,
            COALESCE((SELECT SUM(r.quantity - r.consumed_quantity - r.released_quantity) FROM order_item_reservations r WHERE r.product_id = p.id AND r.status = 'active'), 0) AS reserved_quantity,
            p.stock_quantity - COALESCE((SELECT SUM(r.quantity - r.consumed_quantity - r.released_quantity) FROM order_item_reservations r WHERE r.product_id = p.id AND r.status = 'active'), 0) AS free_stock_quantity
     FROM order_stage_tasks t
     JOIN orders o ON o.id = t.order_id
     JOIN users u ON u.id = o.user_id
     JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE t.assigned_user_id = ? AND t.stage = 'stock_check' AND t.status != 'completed'
     ORDER BY o.created_at ASC, oi.id ASC`,
    [actor.id],
    (err, rows: any[]) => {
      if (err) return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      const map = new Map<number, any>();
      for (const row of rows || []) {
        if (!map.has(row.order_id)) map.set(row.order_id, {
          id: row.order_id, taskId: row.task_id, taskStatus: row.task_status, total: row.total, createdAt: row.created_at,
          customer: row.customer_company || row.customer_email, contactName: row.contact_name,
          contactPhone: row.contact_phone, address: row.address, items: []
        });
        map.get(row.order_id).items.push({
          orderItemId: row.order_item_id, productId: row.product_id, name: row.product_name,
          sku: row.sku, orderedQuantity: row.ordered_quantity,
          stockQuantity: Math.max(0, Number(row.free_stock_quantity ?? row.stock_quantity ?? 0)), availableQuantity: row.available_quantity,
          note: row.warehouse_note
        });
      }
      resolve(NextResponse.json({ orders: Array.from(map.values()) }));
    }
  ));
}

export async function PATCH(request: Request) {
  const actor = await currentUser();
  if (!actor || actor.role !== "order_receiver") return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const orderId = Number(body.orderId);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!Number.isInteger(orderId) || orderId < 1) return NextResponse.json({ error: "Не указан корректный заказ" }, { status: 400 });

  return new Promise<NextResponse>((resolve) => db.get(
    "SELECT t.id, t.status, o.status AS order_status FROM order_stage_tasks t JOIN orders o ON o.id = t.order_id WHERE t.order_id = ? AND t.assigned_user_id = ? AND t.stage = 'stock_check' AND t.status != 'completed'",
    [orderId, actor.id],
    (taskErr, task: any) => {
      if (taskErr || !task) return resolve(NextResponse.json({ error: "Заказ не назначен вам или уже проверен" }, { status: 404 }));
      if (body.action === "accept") {
        if (task.status === "in_progress") return resolve(NextResponse.json({ ok: true, alreadyAccepted: true }));
        if (task.status !== "pending" || task.order_status !== "pending") return resolve(NextResponse.json({ error: "Заказ уже принят другим действием или его этап изменился" }, { status: 409 }));
        return db.run("UPDATE order_stage_tasks SET status = 'in_progress', note = COALESCE(note, 'Принято приёмщиком в работу') WHERE id = ? AND status = 'pending'", [task.id], function (updateError) {
          if (updateError) return resolve(NextResponse.json({ error: "Не удалось принять заказ в работу" }, { status: 500 }));
          if (!this.changes) return resolve(NextResponse.json({ error: "Заказ уже принят другим сотрудником. Обновите очередь." }, { status: 409 }));
          resolve(NextResponse.json({ ok: true, status: "in_progress" }));
        });
      }
      if (!items.length) return resolve(NextResponse.json({ error: "Добавьте проверенные позиции заказа" }, { status: 400 }));
      if (task.status !== "in_progress") return resolve(NextResponse.json({ error: "Сначала примите заказ в работу" }, { status: 409 }));
      db.all(`
        `SELECT oi.id, oi.product_id, oi.quantity, p.stock_quantity,
          p.stock_quantity - COALESCE((SELECT SUM(r.quantity - r.consumed_quantity - r.released_quantity)
            FROM order_item_reservations r WHERE r.product_id = p.id AND r.status = 'active'), 0) AS free_stock_quantity
         FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?`,
        [orderId],
        (itemsErr, actualItems: any[]) => {
          if (itemsErr || !actualItems?.length) return resolve(NextResponse.json({ error: "Не удалось загрузить состав заказа" }, { status: 500 }));
          if (items.length !== actualItems.length) return resolve(NextResponse.json({ error: "Проверьте наличие по каждой позиции заказа" }, { status: 400 }));
          const byId = new Map(items.map((x: any) => [Number(x.orderItemId), x]));
          const confirmedByProduct = new Map<number, number>();
          for (const row of actualItems) {
            const checked: any = byId.get(row.id);
            const qty = Number(checked?.availableQuantity);
            const productId = Number(row.product_id);
            const confirmedForProduct = confirmedByProduct.get(productId) ?? 0;
            if (!checked || !Number.isInteger(qty) || qty < 0 || qty > row.quantity || confirmedForProduct + qty > Number(row.free_stock_quantity ?? row.stock_quantity)) {
              return resolve(NextResponse.json({ error: "Количество в наличии должно быть целым числом и не превышать заказанное или суммарный свободный остаток склада" }, { status: 400 }));
            }
            confirmedByProduct.set(productId, confirmedForProduct + qty);
          }
          let index = 0;
          const saveNext = () => {
            if (index >= actualItems.length) {
              const summary = actualItems.map((row: any) => {
                const value: any = byId.get(row.id);
                return `${row.id}: ${Number(value.availableQuantity)} из ${row.quantity}`;
              }).join("; ");
              db.run("UPDATE orders SET status = 'stock_checked', stock_checked_by = ?, stock_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [actor.id, orderId], (orderErr) => {
                if (orderErr) return resolve(NextResponse.json({ error: orderErr.message }, { status: 500 }));
                db.run("UPDATE order_stage_tasks SET status = 'completed', note = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?", [summary, task.id], (taskUpdateErr) => {
                  if (taskUpdateErr) return resolve(NextResponse.json({ error: taskUpdateErr.message }, { status: 500 }));
                  db.run(
                    "INSERT INTO order_events (order_id, status, title, description, actor_user_id) SELECT id, status, 'Наличие проверено складом', ?, ? FROM orders WHERE id = ?",
                    [summary, actor.id, orderId],
                    async (eventErr) => {
                      if (eventErr) return resolve(NextResponse.json({ error: eventErr.message }, { status: 500 }));
                      await advanceOrderWorkflow(orderId, "stock_check", actor.id);
                      resolve(NextResponse.json({ ok: true }));
                    }
                  );
                });
              });
              return;
            }
            const row = actualItems[index++];
            const value: any = byId.get(row.id);
            db.run("UPDATE order_items SET available_quantity = ?, warehouse_note = ? WHERE id = ?", [
              Number(value.availableQuantity), typeof value.note === "string" ? value.note.trim().slice(0, 300) : null, row.id
            ], (err) => {
              if (err) return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
              // Keep the catalog stock balance unchanged during availability verification.
              // The confirmed quantity belongs to this order line and is stored in order_items.
              saveNext();
            });
          };
          saveNext();
        }
      );
    }
  ));
}
