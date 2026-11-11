import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Некорректный товар" }, { status: 400 });
  return new Promise<NextResponse>((resolve) => db.all(
    `SELECT r.id, r.rating, r.comment, r.admin_reply, r.created_at,
            u.company AS reviewer_name
     FROM product_reviews r JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ? AND r.status = 'approved'
     ORDER BY r.created_at DESC, r.id DESC LIMIT 100`,
    [id],
    (error, reviews: any[]) => {
      if (error) return resolve(NextResponse.json({ error: "Не удалось загрузить отзывы" }, { status: 500 }));
      const rows = reviews || [];
      const average = rows.length ? rows.reduce((sum, review) => sum + Number(review.rating), 0) / rows.length : 0;
      resolve(NextResponse.json({ reviews: rows, count: rows.length, average: Number(average.toFixed(1)) }));
    }
  ));
}

export async function POST(request: Request, { params }: Context) {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Войдите в аккаунт, чтобы оставить отзыв" }, { status: 401 });
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Некорректный товар" }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const rating = Number(body.rating);
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Оценка должна быть от 1 до 5" }, { status: 400 });
  if (comment.length < 5) return NextResponse.json({ error: "Добавьте комментарий не короче 5 символов" }, { status: 400 });

  return new Promise<NextResponse>((resolve) => db.get(
    `SELECT o.id FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'
     ORDER BY o.updated_at DESC LIMIT 1`,
    [userId, id],
    (orderError, order: any) => {
      if (orderError) return resolve(NextResponse.json({ error: "Не удалось проверить покупку" }, { status: 500 }));
      if (!order) return resolve(NextResponse.json({ error: "Оставить отзыв можно только после получения этого товара" }, { status: 403 }));
      db.get(
        "SELECT id, status FROM product_reviews WHERE product_id = ? AND user_id = ?",
        [id, userId],
        (reviewError, existingReview: any) => {
          if (reviewError) return resolve(NextResponse.json({ error: "Не удалось проверить существующий отзыв" }, { status: 500 }));

          if (existingReview && existingReview.status !== "rejected") {
            return resolve(NextResponse.json({ error: existingReview.status === "approved" ? "Отзыв уже опубликован. Повторная отправка не требуется." : "Отзыв уже находится на модерации." }, { status: 409 }));
          }

          if (existingReview) {
            db.run(
              "UPDATE product_reviews SET order_id = ?, rating = ?, comment = ?, status = 'pending', admin_reply = NULL, replied_at = NULL, created_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = 'rejected'",
              [order.id, rating, comment, existingReview.id, userId],
              function (updateError) {
                if (updateError) return resolve(NextResponse.json({ error: "Не удалось обновить отклонённый отзыв" }, { status: 500 }));
                if (this.changes === 0) return resolve(NextResponse.json({ error: "Отзыв уже изменён. Обновите страницу." }, { status: 409 }));
                resolve(NextResponse.json({ ok: true, reviewId: existingReview.id, status: "pending", updated: true }));
              }
            );
            return;
          }

          db.run(
            "INSERT INTO product_reviews (product_id, user_id, order_id, rating, comment, status) VALUES (?, ?, ?, ?, ?, 'pending')",
            [id, userId, order.id, rating, comment],
            function (insertError) {
              if (insertError) return resolve(NextResponse.json({ error: insertError.message.includes("UNIQUE") ? "Вы уже оставляли отзыв на этот товар" : "Не удалось сохранить отзыв" }, { status: insertError.message.includes("UNIQUE") ? 409 : 500 }));
              resolve(NextResponse.json({ ok: true, reviewId: this.lastID, status: "pending" }, { status: 201 }));
            }
          );
        }
      );
    }
  ));
}
