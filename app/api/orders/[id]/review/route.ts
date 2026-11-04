import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const { id } = await params;
  return new Promise<NextResponse>((resolve) => db.get(
    "SELECT r.id, r.rating, r.comment, r.admin_reply, r.created_at, r.replied_at FROM order_reviews r JOIN orders o ON o.id = r.order_id WHERE r.order_id = ? AND o.user_id = ?",
    [id, userId],
    (err, review) => resolve(err ? NextResponse.json({ error: err.message }, { status: 500 }) : NextResponse.json({ review: review || null }))
  ));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const { id } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const rating = Number(body.rating);
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Оценка должна быть от 1 до 5" }, { status: 400 });
  return new Promise<NextResponse>((resolve) => db.get(
    "SELECT id, status FROM orders WHERE id = ? AND user_id = ?",
    [id, userId],
    (err, order: any) => {
      if (err || !order) return resolve(NextResponse.json({ error: "Заказ не найден" }, { status: 404 }));
      if (order.status !== "delivered") return resolve(NextResponse.json({ error: "Оставить отзыв можно после доставки заказа" }, { status: 409 }));
      db.run(
        "INSERT INTO order_reviews (order_id, user_id, rating, comment) VALUES (?, ?, ?, ?)",
        [id, userId, rating, comment || null],
        function (insertErr) {
          if (insertErr) return resolve(NextResponse.json({ error: insertErr.message.includes("UNIQUE") ? "Отзыв по этому заказу уже оставлен" : insertErr.message }, { status: insertErr.message.includes("UNIQUE") ? 409 : 500 }));
          resolve(NextResponse.json({ ok: true, reviewId: this.lastID }, { status: 201 }));
        }
      );
    }
  ));
}
