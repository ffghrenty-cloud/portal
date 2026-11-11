import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";
import { assignStageAutomatically, notifyOrderCustomer } from "@/lib/order-automation";

type DbRunResult = { lastID: number; changes: number };

function dbRun(sql: string, params: any[] = []): Promise<DbRunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row as T | undefined));
  });
}

function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve((rows || []) as T[]));
  });
}

function checkoutError(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) return NextResponse.json({ orders: [] });

  return new Promise<NextResponse>((resolve) => {
    db.all(
      `SELECT id, status, total, contact_name, contact_phone, manager,
              created_at, updated_at
       FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId],
      (err, orders) => resolve(
        err
          ? NextResponse.json({ orders: [] })
          : NextResponse.json({ orders })
      )
    );
  });
}

export async function POST(request: Request) {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Нужно войти в аккаунт" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const { contactName, contactPhone, address, comment } = body;
  const requestedCouponCode = typeof body.couponCode === "string"
    ? body.couponCode.trim().toUpperCase()
    : "";

  if (!items.length || items.length > 100) {
    return NextResponse.json({ error: "Корзина пуста или содержит слишком много позиций" }, { status: 400 });
  }

  for (const item of items) {
    if (
      !Number.isInteger(Number(item.productId)) ||
      Number(item.productId) < 1 ||
      !Number.isInteger(Number(item.quantity)) ||
      Number(item.quantity) < 1 ||
      Number(item.quantity) > 10000
    ) {
      return NextResponse.json({ error: "Проверьте товары и количество в корзине" }, { status: 400 });
    }
  }

  if (requestedCouponCode && !/^[A-Z0-9_-]{3,32}$/.test(requestedCouponCode)) {
    return NextResponse.json({ error: "Некорректный промокод" }, { status: 400 });
  }

  return new Promise<NextResponse>((resolve) => {
    // Все чтения лимитов и все записи заказа выполняются в одной write-транзакции.
    // Это не позволяет двум параллельным запросам занять последнее использование кода.
    db.serialize(() => {
      void (async () => {
        let transactionStarted = false;

        try {
          await dbRun("BEGIN IMMEDIATE");
          transactionStarted = true;

          const user = await dbGet<any>(
            "SELECT discount_percent, discount_valid_until FROM users WHERE id = ? AND role = 'client'",
            [userId]
          );
          if (!user) throw checkoutError("Не удалось проверить аккаунт клиента", 401);

          const ids = items.map((item: any) => Number(item.productId));
          const placeholders = ids.map(() => "?").join(", ");
          const products = await dbAll<any>(
            `SELECT id, name, price FROM products WHERE id IN (${placeholders})`,
            ids
          );
          const productMap = new Map(products.map((product: any) => [Number(product.id), product]));
          if (items.some((item: any) => !productMap.has(Number(item.productId)))) {
            throw checkoutError("Один или несколько товаров больше недоступны в каталоге");
          }

          const subtotal = items.reduce((sum: number, item: any) => {
            const product: any = productMap.get(Number(item.productId));
            return sum + Number(product.price) * Number(item.quantity);
          }, 0);

          const today = new Date().toISOString().slice(0, 10);
          const personalDiscountActive =
            !user.discount_valid_until || user.discount_valid_until >= today;
          const personalDiscount = personalDiscountActive
            ? Math.max(0, Math.min(80, Number(user.discount_percent) || 0))
            : 0;

          let coupon: any = null;
          if (requestedCouponCode) {
            coupon = await dbGet<any>(
              "SELECT * FROM coupons WHERE code = ? AND is_active = 1",
              [requestedCouponCode]
            );
            if (!coupon) throw checkoutError("Промокод не найден или отключён");
            if ((coupon.starts_at && coupon.starts_at > today) || (coupon.expires_at && coupon.expires_at < today)) {
              throw checkoutError("Промокод не действует на текущую дату");
            }
            if (subtotal < Number(coupon.min_subtotal)) {
              throw checkoutError(`Минимальная сумма для промокода — ${coupon.min_subtotal} BYN`);
            }

            const customerUsage = await dbGet<any>(
              "SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?",
              [coupon.id, userId]
            );
            if (Number(customerUsage?.count || 0) >= Number(coupon.max_uses_per_user)) {
              throw checkoutError("Вы исчерпали лимит использования этого промокода", 409);
            }
            if (coupon.max_uses !== null && Number(coupon.usage_count) >= Number(coupon.max_uses)) {
              throw checkoutError("Лимит промокода исчерпан", 409);
            }
          }

          // Персональная скидка и промокод не суммируются: применяется более выгодный вариант.
          const couponDiscount = coupon ? Number(coupon.discount_percent) : 0;
          const discountPercent = Math.max(personalDiscount, couponDiscount);
          const discountAmount = Math.round(subtotal * discountPercent) / 100;
          const total = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

          const order = await dbRun(
            `INSERT INTO orders
              (user_id, status, total, subtotal, discount_percent, discount_amount, coupon_code,
               contact_name, contact_phone, address, comment)
             VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userId, total, subtotal, discountPercent, discountAmount,
              coupon ? coupon.code : null,
              contactName || null, contactPhone || null, address || null, comment || null
            ]
          );
          const orderId = order.lastID;

          if (coupon) {
            // Условное обновление — дополнительная защита общего лимита на уровне SQL.
            const reserved = await dbRun(
              `UPDATE coupons
               SET usage_count = usage_count + 1
               WHERE id = ? AND is_active = 1
                 AND (max_uses IS NULL OR usage_count < max_uses)`,
              [coupon.id]
            );
            if (reserved.changes !== 1) {
              throw checkoutError("Лимит промокода только что был исчерпан. Обновите оформление заказа.", 409);
            }

            await dbRun(
              "INSERT INTO coupon_redemptions (coupon_id, user_id, order_id) VALUES (?, ?, ?)",
              [coupon.id, userId, orderId]
            );
          }

          for (const item of items) {
            const product: any = productMap.get(Number(item.productId));
            await dbRun(
              "INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)",
              [orderId, product.id, product.name, Number(item.quantity), Number(product.price)]
            );
          }

          const eventDescription = coupon
            ? `Заказ оформлен. Применён промокод ${coupon.code}: скидка ${discountPercent}% (${discountAmount.toFixed(2)} BYN).`
            : discountPercent > 0
              ? `Заказ оформлен. Применена персональная скидка ${discountPercent}% (${discountAmount.toFixed(2)} BYN).`
              : "Заказ оформлен и ожидает проверки наличия товаров.";

          await dbRun(
            "INSERT INTO order_events (order_id, status, title, description, actor_user_id) VALUES (?, 'pending', 'Заказ оформлен', ?, ?)",
            [orderId, eventDescription, userId]
          );

          await dbRun("COMMIT");
          transactionStarted = false;

          // Побочные действия запускаются только после успешной фиксации заказа.
          void assignStageAutomatically(orderId, "stock_check");
          void notifyOrderCustomer(
            orderId,
            "Заказ принят",
            "Заявка зарегистрирована. Сотрудник проверит наличие товаров, затем заказ поступит менеджеру."
          );

          resolve(NextResponse.json({
            ok: true,
            orderId,
            subtotal,
            discountPercent,
            discountAmount,
            total,
            couponCode: coupon?.code || null
          }));
        } catch (error: any) {
          if (transactionStarted) {
            try {
              await dbRun("ROLLBACK");
            } catch {
              // Сохраняем исходную ошибку, даже если откат также завершился ошибкой.
            }
          }
          const status = Number(error?.status) || 500;
          resolve(NextResponse.json(
            { error: status === 500 ? "Не удалось оформить заказ. Попробуйте ещё раз." : error.message },
            { status }
          ));
        }
      })();
    });
  });
}
