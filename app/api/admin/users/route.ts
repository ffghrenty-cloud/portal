import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return false;

  return new Promise((resolve) => {
    db.get("SELECT role FROM users WHERE id = ?", [userId], (err, row: any) => {
      resolve(!err && row && row.role === "admin");
    });
  });
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  return new Promise((resolve) => {
    db.all(
      `SELECT
         u.id, u.email, u.company, u.role, u.created_at,
         (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as orders_count,
         (SELECT COALESCE(SUM(total), 0) FROM orders WHERE user_id = u.id AND status != 'cancelled') as orders_sum
       FROM users u
       ORDER BY u.created_at DESC`,
      (err, users) => {
        if (err) {
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ users }));
        }
      }
    );
  });
}