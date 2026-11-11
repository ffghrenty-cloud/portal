import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export async function GET() {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  return new Promise<NextResponse>((resolve) => db.get("SELECT role FROM users WHERE id = ?", [userId], (userErr, user: any) => {
    if (userErr || !user || user.role === "client") return resolve(NextResponse.json({ error: "Нет доступа к рабочей очереди" }, { status: 403 }));
    db.all(
      `SELECT t.id, t.order_id, t.stage, t.status AS task_status, t.note, t.created_at, t.completed_at,
              o.status AS order_status, o.total, o.contact_name, o.contact_phone, o.address,
              u.email AS customer_email, u.company AS customer_company
       FROM order_stage_tasks t JOIN orders o ON o.id = t.order_id JOIN users u ON u.id = o.user_id
       WHERE t.assigned_user_id = ? AND t.stage != 'stock_check'
       ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.created_at ASC`,
      [userId],
      async (err, rows: any[]) => {
        if (err) return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        try {
          const tasks = await Promise.all((rows || []).map(async (task: any) => {
            if (task.stage !== "shipping") return { ...task, items: [] };
            const items = await new Promise<any[]>((res, rej) => db.all(
              `SELECT oi.id, COALESCE(oi.product_name, p.name, 'Товар #' || oi.product_id) AS product_name,
                      oi.quantity, oi.available_quantity, COALESCE(p.stock_quantity, 0) AS stock_quantity,
                      COALESCE((SELECT SUM(fi.quantity)
                                FROM order_fulfillment_items fi
                                JOIN order_fulfillments f ON f.id = fi.fulfillment_id
                                WHERE fi.order_item_id = oi.id AND f.status = 'shipped'), 0) AS shipped_quantity
               FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
               WHERE oi.order_id = ? ORDER BY oi.id ASC`,
              [task.order_id],
              (itemsErr, data) => itemsErr ? rej(itemsErr) : res(data || [])
            ));
            return { ...task, items };
          }));
          resolve(NextResponse.json({ tasks }));
        } catch (itemsError: any) {
          resolve(NextResponse.json({ error: itemsError?.message || "Не удалось загрузить позиции отправлений" }, { status: 500 }));
        }
      }
    );
  }));
}
