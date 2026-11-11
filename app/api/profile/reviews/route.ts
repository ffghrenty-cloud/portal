import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Необходимо войти в аккаунт" }, { status: 401 });

  return new Promise<NextResponse>((resolve) => {
    db.all(
      `SELECT
         oi.product_id,
         COALESCE(p.name, oi.product_name, 'Товар') AS product_name,
         p.image_url,
         SUM(oi.quantity) AS quantity,
         MAX(o.updated_at) AS delivered_at,
         r.id AS review_id,
         r.rating,
         r.comment,
         r.status AS review_status,
         r.admin_reply,
         r.created_at AS review_created_at
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN product_reviews r ON r.product_id = oi.product_id AND r.user_id = o.user_id
       WHERE o.user_id = ? AND o.status = 'delivered'
       GROUP BY oi.product_id
       ORDER BY CASE WHEN r.id IS NULL THEN 0 ELSE 1 END, MAX(o.updated_at) DESC`,
      [userId],
      (error, rows: any[]) => {
        if (error) {
          console.error("Ошибка загрузки товаров для отзывов:", error);
          return resolve(NextResponse.json({ error: "Не удалось загрузить список товаров" }, { status: 500 }));
        }
        resolve(NextResponse.json({ products: rows || [] }, { headers: { "Cache-Control": "no-store" } }));
      }
    );
  });
}
