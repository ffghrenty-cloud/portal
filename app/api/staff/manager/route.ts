import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ManagerUser = { id: number; email: string; role: string };

export async function GET() {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  return new Promise<NextResponse>((resolve) => {
    db.get("SELECT id, email, role FROM users WHERE id = ?", [userId], (userError, user: ManagerUser) => {
      if (userError || !user) return resolve(NextResponse.json({ error: "Пользователь не найден" }, { status: 401 }));
      if (!["manager", "senior_manager"].includes(user.role)) {
        return resolve(NextResponse.json({ error: "Панель доступна только менеджерам" }, { status: 403 }));
      }

      const respond = (tasks: any[]) => {
        if (user.role !== "senior_manager") {
          return resolve(NextResponse.json({ manager: user, tasks }));
        }

        db.all(
          `SELECT o.id, o.status, o.total, o.manager, o.created_at,
                  u.email AS customer_email, u.company AS customer_company, o.contact_name
           FROM orders o
           LEFT JOIN users u ON u.id = o.user_id
           WHERE o.status = 'stock_checked'
           ORDER BY CASE WHEN o.manager IS NULL OR o.manager = '' THEN 0 ELSE 1 END,
                    o.created_at ASC, o.id ASC`,
          (ordersError, teamOrders: any[]) => {
            if (ordersError) return resolve(NextResponse.json({ error: "Не удалось загрузить очередь распределения" }, { status: 500 }));
            db.all(
              "SELECT id, email, role FROM users WHERE role IN ('manager', 'senior_manager') ORDER BY created_at ASC, id ASC",
              (staffError, managers: any[]) => {
                if (staffError) return resolve(NextResponse.json({ error: "Не удалось загрузить список менеджеров" }, { status: 500 }));
                resolve(NextResponse.json({ manager: user, tasks, teamOrders: teamOrders || [], managers: managers || [] }));
              }
            );
          }
        );
      };

      db.all(
        `SELECT t.id AS task_id, t.order_id, t.status AS task_status, t.note AS task_note,
                t.created_at AS assigned_at, o.status AS order_status, o.total,
                o.discount_percent, o.contact_name, o.contact_phone, o.address, o.comment,
                o.created_at AS order_created_at, u.email AS customer_email, u.company AS customer_company
         FROM order_stage_tasks t
         JOIN orders o ON o.id = t.order_id
         JOIN users u ON u.id = o.user_id
         WHERE t.assigned_user_id = ? AND t.stage = 'manager_review'
         ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
                  t.created_at ASC, t.id ASC`,
        [userId],
        (tasksError, rows: any[]) => {
          if (tasksError) return resolve(NextResponse.json({ error: "Ошибка очереди менеджера: " + tasksError.message }, { status: 500 }));
          const tasks = rows || [];
          if (!tasks.length) return respond([]);
          let remaining = tasks.length;
          let failed = false;
          tasks.forEach((task) => {
            db.all(
              `SELECT oi.id, oi.product_name, oi.quantity, oi.price, oi.available_quantity,
                      p.stock_quantity - COALESCE((SELECT SUM(r.quantity - r.consumed_quantity - r.released_quantity)
                        FROM order_item_reservations r WHERE r.product_id = p.id AND r.status = 'active'), 0) AS stock_quantity
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
                if (remaining === 0 && !failed) respond(tasks);
              }
            );
          });
        }
      );
    });
  });
}
