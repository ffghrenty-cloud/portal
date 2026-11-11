import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row as T | undefined));
  });
}

function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve((rows || []) as T[]));
  });
}

export async function POST(request: Request) {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const code = String(body.code || "").trim().toUpperCase();
  const items = Array.isArray(body.items) ? body.items : [];
  if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !items.length || items.length > 100) {
    return NextResponse.json({ error: "Проверьте промокод и состав корзины" }, { status: 400 });
  }
  if (items.some((item: any) =>
    !Number.isInteger(Number(item.productId)) || Number(item.productId) < 1 ||
    !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 ||
    Number(item.quantity) > 10000
  )) {
    return NextResponse.json({ error: "Некорректный состав корзины" }, { status: 400 });
  }

  try {
    const ids = items.map((item: any) => Number(item.productId));
    const placeholders = ids.map(() => "?").join(", ");
    const products = await all<any>(
      `SELECT id, price FROM products WHERE id IN (${placeholders})`,
      ids
    );
    const productMap = new Map(products.map((product: any) => [Number(product.id), product]));
    if (items.some((item: any) => !productMap.has(Number(item.productId)))) {
      return NextResponse.json({ error: "Один или несколько товаров больше недоступны" }, { status: 400 });
    }

    // Сумма рассчитывается по ценам каталога, а не по данным, присланным браузером.
    const subtotal = Math.round(items.reduce((sum: number, item: any) => {
      const product: any = productMap.get(Number(item.productId));
      return sum + Number(product.price) * Number(item.quantity);
    }, 0) * 100) / 100;

    const today = new Date().toISOString().slice(0, 10);
    const coupon = await get<any>(
      "SELECT * FROM coupons WHERE code = ? AND is_active = 1",
      [code]
    );
    if (!coupon) return NextResponse.json({ error: "Промокод не найден или отключён" }, { status: 404 });
    if ((coupon.starts_at && coupon.starts_at > today) || (coupon.expires_at && coupon.expires_at < today)) {
      return NextResponse.json({ error: "Промокод не действует на текущую дату" }, { status: 400 });
    }
    if (subtotal < Number(coupon.min_subtotal)) {
      return NextResponse.json({ error: `Минимальная сумма заказа для промокода — ${coupon.min_subtotal} BYN` }, { status: 400 });
    }
    if (coupon.max_uses !== null && Number(coupon.usage_count) >= Number(coupon.max_uses)) {
      return NextResponse.json({ error: "Лимит использований промокода исчерпан" }, { status: 409 });
    }

    const usage = await get<any>(
      "SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?",
      [coupon.id, userId]
    );
    if (Number(usage?.count || 0) >= Number(coupon.max_uses_per_user)) {
      return NextResponse.json({ error: "Вы уже использовали этот промокод максимально допустимое число раз" }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      code: coupon.code,
      subtotal,
      discountPercent: Number(coupon.discount_percent),
      discountAmount: Math.round(subtotal * Number(coupon.discount_percent)) / 100
    });
  } catch {
    return NextResponse.json({ error: "Не удалось проверить промокод" }, { status: 500 });
  }
}
