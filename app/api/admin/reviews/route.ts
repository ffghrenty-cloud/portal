import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function isAdmin() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return false;
  return new Promise<boolean>((resolve) => db.get("SELECT role FROM users WHERE id = ?", [id], (err, user: any) => resolve(!err && user?.role === "admin")));
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  return new Promise<NextResponse>((resolve) => db.all(
    `SELECT r.id, r.order_id, r.rating, r.comment, r.admin_reply, r.created_at, r.replied_at,
            u.email AS customer_email, u.company AS customer_company
     FROM order_reviews r JOIN users u ON u.id = r.user_id
     ORDER BY r.created_at DESC`,
    (err, reviews) => resolve(err ? NextResponse.json({ error: err.message }, { status: 500 }) : NextResponse.json({ reviews }))
  ));
}
