import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";
import { assignStageAutomatically, notifyOrderCustomer } from "@/lib/order-automation";

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) {
    return NextResponse.json({ orders: [] });
  }

  return new Promise<NextResponse>((resolve) => {
    db.all(
      `SELECT id, status, total, contact_name, contact_phone, manager,
              created_at, updated_at
       FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId],
      (err, orders) => {
        if (err) {
          resolve(NextResponse.json({ orders: [] }));
        } else {
          resolve(NextResponse.json({ orders }));
        }
      }
    );
  });
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "Нужно войти в аккаунт" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { items, contactName, contactPhone, address, comment } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Корзина пуста" }, { status: 400 });
    }

    const total = items.reduce(
      (sum: number, i: any) => sum + i.price * i.quantity,
      0
    );

    return new Promise<NextResponse>((resolve) => {
      db.run(
        `INSERT INTO orders
         (user_id, status, total, contact_name, contact_phone, address, comment)
         VALUES (?, 'pending', ?, ?, ?, ?, ?)`,
        [userId, total, contactName, contactPhone, address, comment],
        function (err) {
          if (err) {
            return resolve(
              NextResponse.json({ error: err.message }, { status: 500 })
            );
          }

          const orderId = this.lastID;
          db.run(
            `INSERT INTO order_events (order_id, status, title, description, actor_user_id)
             VALUES (?, 'pending', 'Заказ оформлен', 'Заказ отправлен. Сотрудник проверит наличие товаров, затем заказ поступит менеджеру', ?)`,
            [orderId, userId]
          );
          const stmt = db.prepare(
            `INSERT INTO order_items
             (order_id, product_id, product_name, quantity, price)
             VALUES (?, ?, ?, ?, ?)`
          );

          let completed = 0;
          const totalItems = items.length;
          let hasError = false;

          for (const item of items) {
            stmt.run(
              [orderId, item.productId, item.name, item.quantity, item.price],
              (err) => {
                if (err && !hasError) {
                  hasError = true;
                  stmt.finalize();
                  return resolve(
                    NextResponse.json({ error: err.message }, { status: 500 })
                  );
                }
                completed++;
                if (completed === totalItems && !hasError) {
                  stmt.finalize();
                  void assignStageAutomatically(orderId, "stock_check");
                  void notifyOrderCustomer(
                    orderId,
                    "Заказ принят",
                    "Заказ зарегистрирован. Менеджер автоматически получил задачу на проверку."
                  );
                  resolve(NextResponse.json({ ok: true, orderId }));
                }
              }
            );
          }
        }
      );
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}