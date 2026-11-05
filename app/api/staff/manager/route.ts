import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  return new Promise<NextResponse>((resolve) => {
    db.get("SELECT id, email, role FROM users WHERE id = ?", [userId], (userError, user: any) => {
      if (userError || !user) return resolve(NextResponse.json({ error: "Пользователь не найден" }, { status: 401 }));
      if (!["manager", "senior_manager"].includes(user.role)) {
        return resolve(NextResponse.json({ error: "Панель доступна только менеджерам" }, { status: 403 }));
      }

      db.all(
        `SELECT t.id AS task_id, t.order_id, t.status AS task_status, t.note AS task_note,
                t.created_at AS assigned_at, o.status AS order_status, o.total,
                o.discount_percent, o.contact_name, o.contact_phone, o.address, o.comment,
                o.created_at AS order_created_at, u.email AS customer_email, u.company AS customer_company
         FROM order_stage_tasks t
         JOIN orders o ON o.id = t.order_id
         JOIN users u ON u.id = o.user_id
         WHERE t.assigned_user_id = ? AND t.stage = 'manager_review'
         ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.created_at ASC`,
        [userId],
        (tasksError, rows: any[]) => {
          if (tasksError) return resolve(NextResponse.json({ error: "Ошибка очереди менеджера: " + tasksError.message }, { status: 500 }));
          const tasks = rows || [];
          if (!tasks.length) return resolve(NextResponse.json({ manager: { email: user.email, role: user.role }, tasks: [] }));

          let remaining = tasks.length;
          let failed = false;
          tasks.forEach((task) => {
            db.all(
              `SELECT oi.id, oi.product_name, oi.quantity, oi.price, oi.available_quantity,
                      p.stock_quantity
               FROM order_items oi
               LEFT JOIN products p ON p.id = oi.product_id
               WHERE oi.order_id = ? ORDER BY oi.id ASC`,
              [task.order_id],
              (itemsError, items: any[]) => {
                if (itemsError && !failed) {
                  failed = true;
                  resolve(NextResponse.json({ error: "Не удалось загрузить состав заказов" }, { status: 500 }));
                  return;
                }
                task.items = (items || []).map((item) => ({
                  ...item,
                  stock_quantity: Number(item.stock_quantity || 0),
                  available_quantity: item.available_quantity == null ? null : Number(item.available_quantity),
                }));
                remaining -= 1;
                if (remaining === 0 && !failed) {
                  resolve(NextResponse.json({ manager: { email: user.email, role: user.role }, tasks }));
                }
              }
            );
          });
        }
      );
    });
  });
}
