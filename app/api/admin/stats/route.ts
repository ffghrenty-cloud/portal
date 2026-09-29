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
    db.get(
      `SELECT
         (SELECT COUNT(*) FROM orders) as total_orders,
         (SELECT COUNT(*) FROM orders WHERE status IN ('pending','confirmed','production','ready')) as active_orders,
         (SELECT COUNT(*) FROM users WHERE role = 'client') as total_clients,
         (SELECT COUNT(*) FROM products) as total_products,
         (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status != 'cancelled') as total_sum
      `,
      (err, stats: any) => {
        if (err) {
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ stats }));
        }
      }
    );
  });
}