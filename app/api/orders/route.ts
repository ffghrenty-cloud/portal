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
    const userId = (await cookies()).get("userId")?.value;
    if (!userId) return NextResponse.json({ error: "Нужно войти в аккаунт" }, { status: 401 });
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const { contactName, contactPhone, address, comment } = body;
    if (!items.length || items.length > 100) return NextResponse.json({ error: "Корзина пуста или содержит слишком много позиций" }, { status: 400 });
    for (const item of items) {
      if (!Number.isInteger(Number(item.productId)) || Number(item.productId) < 1 || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 10000) {
        return NextResponse.json({ error: "Проверьте товары и количество в корзине" }, { status: 400 });
      }
    }
    return new Promise<NextResponse>((resolve) => db.get(
      "SELECT discount_percent, discount_valid_until FROM users WHERE id = ? AND role = 'client'",
      [userId],
      (userErr, user: any) => {
        if (userErr || !user) return resolve(NextResponse.json({ error: "Не удалось проверить аккаунт клиента" }, { status: 500 }));
        const ids = items.map((item: any) => Number(item.productId));
        const placeholders = ids.map(() => "?").join(", ");
        db.all(`SELECT id, name, price FROM products WHERE id IN (${placeholders})`, ids, (productsErr, products: any[]) => {
          if (productsErr) return resolve(NextResponse.json({ error: productsErr.message }, { status: 500 }));
          const productMap = new Map((products || []).map((product: any) => [Number(product.id), product]));
          if (items.some((item: any) => !productMap.has(Number(item.productId)))) return resolve(NextResponse.json({ error: "Один или несколько товаров больше недоступны в каталоге" }, { status: 400 }));
          const subtotal = items.reduce((sum: number, item: any) => sum + Number((productMap.get(Number(item.productId)) as any).price) * Number(item.quantity), 0);
          const discountActive = !user.discount_valid_until || user.discount_valid_until >= new Date().toISOString().slice(0, 10);
          const discountPercent = discountActive ? Math.max(0, Math.min(80, Number(user.discount_percent) || 0)) : 0;
          const discountAmount = Math.round(subtotal * discountPercent) / 100;
          const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
          db.run(
            `INSERT INTO orders (user_id, status, total, subtotal, discount_percent, discount_amount, contact_name, contact_phone, address, comment)
             VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, total, subtotal, discountPercent, discountAmount, contactName || null, contactPhone || null, address || null, comment || null],
            function (orderErr) {
              if (orderErr) return resolve(NextResponse.json({ error: orderErr.message }, { status: 500 }));
              const orderId = this.lastID;
              const stmt = db.prepare("INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)");
              let remaining = items.length;
              let failed = false;
              for (const item of items) {
                const product: any = productMap.get(Number(item.productId));
                stmt.run([orderId, product.id, product.name, Number(item.quantity), Number(product.price)], (itemErr) => {
                  if (itemErr && !failed) {
                    failed = true;
                    stmt.finalize();
                    return resolve(NextResponse.json({ error: itemErr.message }, { status: 500 }));
                  }
                  remaining--;
                  if (remaining === 0 && !failed) {
                    stmt.finalize();
                    const eventDescription = discountPercent > 0
                      ? `Заказ оформлен. Применена персональная скидка ${discountPercent}% (${discountAmount.toFixed(2)} BYN).`
                      : "Заказ оформлен и ожидает проверки наличия товаров.";
                    db.run(
                      "INSERT INTO order_events (order_id, status, title, description, actor_user_id) VALUES (?, 'pending', 'Заказ оформлен', ?, ?)",
                      [orderId, eventDescription, userId],
                      () => {
                        void assignStageAutomatically(orderId, "stock_check");
                        void notifyOrderCustomer(orderId, "Заказ принят", "Заявка зарегистрирована. Сотрудник проверит наличие товаров, затем заказ поступит менеджеру.");
                        resolve(NextResponse.json({ ok: true, orderId, subtotal, discountPercent, discountAmount, total }));
                      }
                    );
                  }
                });
              }
            }
          );
        });
      }
    ));
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка оформления заказа" }, { status: 500 });
  }
}
