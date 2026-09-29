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

  return new Promise((resolve) => {
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
            resolve(NextResponse.json({ order, items }));
          }
        );
      }
    );
  });
}