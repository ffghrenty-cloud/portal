import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function isAdmin() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return false;
  return new Promise<boolean>((resolve) => db.get("SELECT role FROM users WHERE id = ?", [id], (err, user: any) => resolve(!err && user?.role === "admin")));
}

// Аналитика отражает фактически отгруженные единицы, а не все позиции из
// оформленных заказов. Поэтому незавершённые и отменённые заявки не искажают рейтинг.
const SHIPPED_LINE = `
  SELECT oi.id AS order_item_id, oi.product_id,
         COALESCE(oi.product_name, p.name, 'Товар #' || oi.product_id) AS product_name,
         COALESCE(p.category, 'Без категории') AS category,
         fi.quantity AS shipped_quantity,
         oi.price * fi.quantity * (1 - COALESCE(o.discount_percent, 0) / 100.0) AS net_revenue,
         o.id AS order_id,
         date(COALESCE(f.shipped_at, f.created_at)) AS shipped_date
  FROM order_fulfillment_items fi
  JOIN order_fulfillments f ON f.id = fi.fulfillment_id AND f.status = 'shipped'
  JOIN order_items oi ON oi.id = fi.order_item_id
  JOIN orders o ON o.id = f.order_id
  LEFT JOIN products p ON p.id = oi.product_id
  WHERE o.status != 'cancelled'
`;

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

  const queries = [
    ["topProducts", `
      WITH shipped_lines AS (${SHIPPED_LINE})
      SELECT product_id, product_name AS name,
             SUM(shipped_quantity) AS units_sold,
             COUNT(DISTINCT order_id) AS orders_count,
             ROUND(SUM(net_revenue), 2) AS revenue
      FROM shipped_lines
      GROUP BY product_id, product_name
      ORDER BY units_sold DESC, revenue DESC
      LIMIT 10
    `],
    ["monthlySales", `
      WITH shipped_lines AS (${SHIPPED_LINE})
      SELECT strftime('%Y-%m', shipped_date) AS month,
             COUNT(DISTINCT order_id) AS orders_count,
             ROUND(SUM(net_revenue), 2) AS revenue
      FROM shipped_lines
      WHERE shipped_date >= date('now', 'start of month', '-11 months')
      GROUP BY strftime('%Y-%m', shipped_date)
      ORDER BY month DESC
      LIMIT 12
    `],
    ["categories", `
      WITH shipped_lines AS (${SHIPPED_LINE})
      SELECT category, SUM(shipped_quantity) AS units_sold,
             ROUND(SUM(net_revenue), 2) AS revenue
      FROM shipped_lines
      GROUP BY category
      ORDER BY units_sold DESC, revenue DESC
      LIMIT 8
    `],
    ["summary", `
      WITH shipped_lines AS (${SHIPPED_LINE}),
      order_totals AS (
        SELECT order_id, SUM(net_revenue) AS revenue
        FROM shipped_lines GROUP BY order_id
      )
      SELECT COUNT(*) AS orders_count,
             ROUND(COALESCE(AVG(revenue), 0), 2) AS average_order,
             ROUND(COALESCE(SUM(revenue), 0), 2) AS revenue,
             (SELECT COUNT(*) FROM orders o
              WHERE o.status = 'delivered'
                AND EXISTS (SELECT 1 FROM order_fulfillments f
                            WHERE f.order_id = o.id AND f.status = 'shipped')) AS delivered_orders
      FROM order_totals
    `]
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

  // Всегда возвращаем 12 календарных месяцев, включая месяцы без продаж.
  const monthlyByKey = new Map<string, any>((result.monthlySales || []).map((row: any) => [row.month, row]));
  const months: any[] = [];
  const now = new Date();
  for (let offset = 11; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.push(monthlyByKey.get(key) || { month: key, orders_count: 0, revenue: 0 });
  }
  result.monthlySales = months;
  return NextResponse.json(result);
}
