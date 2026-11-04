import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return false;

  return new Promise((resolve) => {
    db.get("SELECT role FROM users WHERE id = ?", [userId], (err, row: any) => {
      resolve(!err && row && row.role === "admin");
    });
  });
}

const ALLOWED_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "production",
  "warehouse",
  "picking",
  "quality_check",
  "packing",
  "ready",
  "shipped",
  "delivered",
  "cancelled",
];

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
  const { status, manager } = body;

  if (status && !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 });
  }

  return new Promise((resolve) => {
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
            pending: "Заказ ожидает менеджера",
            confirmed: "Заказ согласован",
            production: "Передан в производство",
            warehouse: "Передан на склад",
            picking: "Заказ комплектуется",
            quality_check: "Проверка комплектации",
            packing: "Упаковка заказа",
            ready: "Заказ готов к отгрузке",
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
        } else {
          resolve(NextResponse.json({ ok: true, changes: this.changes }));
        }
      }
    );
  });
}