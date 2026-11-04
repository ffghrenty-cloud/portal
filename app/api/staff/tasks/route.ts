import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export async function GET() {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  return new Promise((resolve) => db.get("SELECT role FROM users WHERE id = ?", [userId], (userErr, user: any) => {
    if (userErr || !user || user.role === "client") return resolve(NextResponse.json({ error: "Нет доступа к рабочей очереди" }, { status: 403 }));
    db.all(
      `SELECT t.id, t.order_id, t.stage, t.status AS task_status, t.note, t.created_at, t.completed_at,
              o.status AS order_status, o.total, o.contact_name, o.contact_phone, o.address,
              u.email AS customer_email, u.company AS customer_company
       FROM order_stage_tasks t JOIN orders o ON o.id = t.order_id JOIN users u ON u.id = o.user_id
       WHERE t.assigned_user_id = ?
       ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.created_at ASC`,
      [userId], (err, tasks) => resolve(err ? NextResponse.json({ error: err.message }, { status: 500 }) : NextResponse.json({ tasks }))
    );
  }));
}
