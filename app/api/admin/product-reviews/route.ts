import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function isAdmin() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return false;
  return new Promise<boolean>((resolve) => db.get("SELECT role FROM users WHERE id = ?", [id], (error, row: any) => resolve(!error && row?.role === "admin")));
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  return new Promise<NextResponse>((resolve) => db.all(
    `SELECT r.id, r.product_id, r.order_id, r.rating, r.comment, r.status,
            r.admin_reply, r.created_at, p.name AS product_name,
            u.email AS customer_email, u.company AS customer_company
     FROM product_reviews r
     JOIN products p ON p.id = r.product_id
     JOIN users u ON u.id = r.user_id
     ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, r.created_at DESC`,
    (error, reviews) => resolve(error
      ? NextResponse.json({ error: "Не удалось загрузить отзывы" }, { status: 500 })
      : NextResponse.json({ reviews }))
  ));
}
