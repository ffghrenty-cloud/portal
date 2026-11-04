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
  const queries = [
    ["topProducts", `SELECT oi.product_id, COALESCE(oi.product_name, p.name) AS name,
       SUM(oi.quantity) AS units_sold, COUNT(DISTINCT oi.order_id) AS orders_count,
       ROUND(SUM(oi.quantity * oi.price), 2) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.status != 'cancelled'
       GROUP BY oi.product_id, oi.product_name, p.name
       ORDER BY units_sold DESC, revenue DESC LIMIT 10`],
    ["monthlySales", `SELECT strftime('%Y-%m', created_at) AS month,
       COUNT(*) AS orders_count, ROUND(SUM(total), 2) AS revenue
       FROM orders WHERE status != 'cancelled'
       GROUP BY strftime('%Y-%m', created_at) ORDER BY month DESC LIMIT 12`],
    ["categories", `SELECT COALESCE(p.category, 'Без категории') AS category,
       SUM(oi.quantity) AS units_sold, ROUND(SUM(oi.quantity * oi.price), 2) AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.status != 'cancelled'
       GROUP BY COALESCE(p.category, 'Без категории')
       ORDER BY units_sold DESC LIMIT 8`],
    ["summary", `SELECT COUNT(*) AS orders_count, ROUND(COALESCE(AVG(total), 0), 2) AS average_order,
       ROUND(COALESCE(SUM(total), 0), 2) AS revenue,
       COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_orders
       FROM orders WHERE status != 'cancelled'`]
  ] as const;
  const result: Record<string, any> = {};
  for (const [key, sql] of queries) {
    const rows = await new Promise<any>((resolve, reject) => {
      if (key === "summary") db.get(sql, (err, row) => err ? reject(err) : resolve(row));
      else db.all(sql, (err, data) => err ? reject(err) : resolve(data));
    }).catch(err => ({ error: err.message }));
    if (rows && rows.error) return NextResponse.json({ error: rows.error }, { status: 500 });
    result[key] = rows;
  }
  result.monthlySales = (result.monthlySales || []).reverse();
  return NextResponse.json(result);
}
