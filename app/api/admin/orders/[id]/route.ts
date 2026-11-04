import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return false;

  return new Promise<boolean>((resolve) => {
    db.get("SELECT role FROM users WHERE id = ?", [userId], (err, row: any) => {
      resolve(!err && row && row.role === "admin");
    });
  });
}

const ALLOWED_STATUSES = [
  "draft",
  "pending",
  "stock_checked",
  "confirmed",
  "production",
  "warehouse",
  "picking",
  "quality_check",
  "packing",
  "ready",
  "partially_shipped",
  "shipped",
  "delivered",
  "cancelled",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  return new Promise<NextResponse>((resolve) => db.get(
    "SELECT id, status, total, subtotal, discount_percent, discount_amount, manager, tracking_carrier, tracking_number, estimated_delivery FROM orders WHERE id = ?",
    [id],
    (err, order: any) => {
      if (err) return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      if (!order) return resolve(NextResponse.json({ error: "Заказ не найден" }, { status: 404 }));
      db.all(
        `SELECT oi.id, oi.product_id, oi.product_name, oi.quantity, oi.price, oi.available_quantity, p.stock_quantity,
          COALESCE((SELECT SUM(fi.quantity) FROM order_fulfillment_items fi JOIN order_fulfillments f ON f.id = fi.fulfillment_id WHERE fi.order_item_id = oi.id AND f.status = 'shipped'), 0) AS shipped_quantity
         FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? ORDER BY oi.id ASC`,
        [id],
        (itemsErr, items) => resolve(itemsErr
          ? NextResponse.json({ error: itemsErr.message }, { status: 500 })
          : NextResponse.json({ order, items }))
      );
    }
  ));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const cookieStore = await cookies();
  const actorId = cookieStore.get("userId")?.value ?? null;
  const body = await request.json();
  const { status, manager, trackingCarrier, trackingNumber, estimatedDelivery } = body;

  if (status && !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 });
  }

  return new Promise<NextResponse>((resolve) => {
    const updates: string[] = [];
    const values: any[] = [];

    if (status) {
      updates.push("status = ?");
      values.push(status);
    }
    if (manager !== undefined) {
      updates.push("manager = ?");
      values.push(manager);
    }
    if (trackingCarrier !== undefined) {
      updates.push("tracking_carrier = ?");
      values.push(String(trackingCarrier).trim().slice(0, 100) || null);
    }
    if (trackingNumber !== undefined) {
      updates.push("tracking_number = ?");
      values.push(String(trackingNumber).trim().slice(0, 120) || null);
    }
    if (estimatedDelivery !== undefined) {
      updates.push("estimated_delivery = ?");
      values.push(String(estimatedDelivery).trim().slice(0, 30) || null);
    }
    const trackingChanged = trackingCarrier !== undefined || trackingNumber !== undefined || estimatedDelivery !== undefined;
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    db.run(
      `UPDATE orders SET ${updates.join(", ")} WHERE id = ?`,
      values,
      function (err) {
        if (err) {
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        } else if (status && this.changes > 0) {
          const titles: Record<string, string> = {
            draft: "Черновик заказа",
            pending: "Заказ ожидает проверки наличия",
            stock_checked: "Наличие проверено складом",
            confirmed: "Заказ согласован",
            production: "Передан в производство",
            warehouse: "Передан на склад",
            picking: "Заказ комплектуется",
            quality_check: "Проверка комплектации",
            packing: "Упаковка заказа",
            ready: "Заказ готов к отгрузке",
            partially_shipped: "Часть заказа отгружена",
            shipped: "Заказ отгружен",
            delivered: "Заказ доставлен",
            cancelled: "Заказ отменён",
          };
          db.run(
            `INSERT INTO order_events (order_id, status, title, description, actor_user_id)
             VALUES (?, ?, ?, ?, ?)`,
            [id, status, titles[status] || "Статус заказа изменён", "Этап обновлён сотрудником предприятия", actorId],
            (eventError) => {
              if (eventError) {
                resolve(NextResponse.json({ error: eventError.message }, { status: 500 }));
              } else {
                resolve(NextResponse.json({ ok: true, changes: 1 }));
              }
            }
          );
        } else if (trackingChanged && this.changes > 0) {
          db.run(
            "INSERT INTO order_events (order_id, status, title, description, actor_user_id) SELECT id, status, 'Данные доставки обновлены', 'Добавлены или изменены сведения для отслеживания отправления', ? FROM orders WHERE id = ?",
            [actorId, id],
            (eventError) => resolve(eventError
              ? NextResponse.json({ error: eventError.message }, { status: 500 })
              : NextResponse.json({ ok: true, changes: this.changes })
            )
          );
        } else {
          resolve(NextResponse.json({ ok: true, changes: this.changes }));
        }
      }
    );
  });
}