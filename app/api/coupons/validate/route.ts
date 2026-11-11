import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export async function GET(request: Request) {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") || "").trim().toUpperCase();
  const subtotal = Number(url.searchParams.get("subtotal"));
  if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !Number.isFinite(subtotal) || subtotal < 0) return NextResponse.json({ error: "Проверьте код и сумму заказа" }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  return new Promise<NextResponse>((resolve) => db.get(
    "SELECT * FROM coupons WHERE code = ? AND is_active = 1",
    [code],
    (error, coupon: any) => {
      if (error) return resolve(NextResponse.json({ error: "Не удалось проверить промокод" }, { status: 500 }));
      if (!coupon) return resolve(NextResponse.json({ error: "Промокод не найден или отключён" }, { status: 404 }));
      if (coupon.starts_at && coupon.starts_at > today) return resolve(NextResponse.json({ error: "Срок действия промокода ещё не начался" }, { status: 400 }));
      if (coupon.expires_at && coupon.expires_at < today) return resolve(NextResponse.json({ error: "Срок действия промокода закончился" }, { status: 400 }));
      if (subtotal < Number(coupon.min_subtotal)) return resolve(NextResponse.json({ error: `Минимальная сумма заказа для промокода — ${coupon.min_subtotal} BYN` }, { status: 400 }));
      if (coupon.max_uses !== null && Number(coupon.usage_count) >= Number(coupon.max_uses)) return resolve(NextResponse.json({ error: "Лимит использований промокода исчерпан" }, { status: 409 }));
      db.get("SELECT COUNT(*) AS count FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?", [coupon.id, userId], (countError, row: any) => {
        if (countError) return resolve(NextResponse.json({ error: "Не удалось проверить лимит клиента" }, { status: 500 }));
        if (Number(row?.count || 0) >= Number(coupon.max_uses_per_user)) return resolve(NextResponse.json({ error: "Вы уже использовали этот промокод максимально допустимое число раз" }, { status: 409 }));
        resolve(NextResponse.json({ ok: true, code: coupon.code, discountPercent: Number(coupon.discount_percent), discountAmount: Math.round(subtotal * Number(coupon.discount_percent)) / 100 }));
      });
    }
  ));
}
