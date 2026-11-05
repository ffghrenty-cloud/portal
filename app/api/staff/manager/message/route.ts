import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const orderId = Number(body.orderId);
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 3000) : "";
  if (!Number.isInteger(orderId) || orderId < 1 || !message) {
    return NextResponse.json({ error: "Укажите заказ и текст сообщения" }, { status: 400 });
  }

  return new Promise<NextResponse>((resolve) => db.get(
    `SELECT u.role, o.user_id AS customer_id
     FROM users u
     JOIN order_stage_tasks t ON t.assigned_user_id = u.id
     JOIN orders o ON o.id = t.order_id
     WHERE u.id = ? AND o.id = ? AND t.stage = 'manager_review'`,
    [userId, orderId],
    (err, row: any) => {
      if (err) return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      if (!row || !["manager", "senior_manager"].includes(row.role)) {
        return resolve(NextResponse.json({ error: "Можно писать только по заказам, назначенным вам" }, { status: 403 }));
      }
      db.run(
        "INSERT INTO admin_messages (user_id, text, is_from_admin) VALUES (?, ?, 1)",
        [row.customer_id, message],
        function (insertError) {
          if (insertError) return resolve(NextResponse.json({ error: insertError.message }, { status: 500 }));
          resolve(NextResponse.json({ ok: true, messageId: this.lastID }, { status: 201 }));
        }
      );
    }
  ));
}
