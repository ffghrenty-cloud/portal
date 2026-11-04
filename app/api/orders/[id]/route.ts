import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  const { id } = await params;

  if (!userId) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  return new Promise<NextResponse>((resolve) => {
    db.get(
      `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
      [id, userId],
      (err, order: any) => {
        if (err || !order) {
          return resolve(
            NextResponse.json({ error: "Заказ не найден" }, { status: 404 })
          );
        }

        db.all(
          `SELECT id, product_id, product_name, quantity, price
           FROM order_items WHERE order_id = ?`,
          [id],
          (err2, items) => {
            if (err2) {
              return resolve(
                NextResponse.json({ error: err2.message }, { status: 500 })
              );
            }
            db.all(
              `SELECT e.id, e.status, e.title, e.description, e.created_at,
                      u.email AS actor_email
               FROM order_events e
               LEFT JOIN users u ON u.id = e.actor_user_id
               WHERE e.order_id = ?
               ORDER BY e.created_at ASC, e.id ASC`,
              [id],
              (err3, events) => {
                if (err3) {
                  return resolve(NextResponse.json({ error: err3.message }, { status: 500 }));
                }
                db.all(
                  "SELECT id, title, message, is_read, created_at FROM order_notifications WHERE order_id = ? AND user_id = ? ORDER BY created_at DESC, id DESC",
                  [id, userId],
                  (notificationError, notifications) => {
                    if (notificationError) {
                      return resolve(NextResponse.json({ error: notificationError.message }, { status: 500 }));
                    }
                    resolve(NextResponse.json({ order, items, events, notifications }));
                  }
                );
              }
            );
          }
        );
      }
    );
  });
}