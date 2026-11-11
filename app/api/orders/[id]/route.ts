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
          `SELECT oi.id, oi.product_id, oi.product_name, oi.quantity, oi.price,
                  COALESCE((SELECT SUM(fi.quantity)
                            FROM order_fulfillment_items fi
                            JOIN order_fulfillments f ON f.id = fi.fulfillment_id
                            WHERE fi.order_item_id = oi.id AND f.status = 'shipped'), 0) AS shipped_quantity
           FROM order_items oi WHERE oi.order_id = ?`,
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
                    db.all(
                      `SELECT f.id, f.status, f.tracking_carrier, f.tracking_number, f.note, f.created_at, f.shipped_at,
                              oi.product_name, fi.quantity
                       FROM order_fulfillments f
                       JOIN order_fulfillment_items fi ON fi.fulfillment_id = f.id
                       JOIN order_items oi ON oi.id = fi.order_item_id
                       WHERE f.order_id = ? ORDER BY f.created_at ASC, fi.id ASC`,
                      [id],
                      (fulfillmentError, rows: any[]) => {
                        if (fulfillmentError) return resolve(NextResponse.json({ error: fulfillmentError.message }, { status: 500 }));
                        const map = new Map<number, any>();
                        for (const row of rows || []) {
                          if (!map.has(row.id)) map.set(row.id, {
                            id: row.id, status: row.status, carrier: row.tracking_carrier,
                            trackingNumber: row.tracking_number, note: row.note,
                            createdAt: row.created_at, shippedAt: row.shipped_at, items: []
                          });
                          map.get(row.id).items.push({ name: row.product_name, quantity: row.quantity });
                        }
                        resolve(NextResponse.json({ order, items, events, notifications, fulfillments: Array.from(map.values()) }));
                      }
                    );
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