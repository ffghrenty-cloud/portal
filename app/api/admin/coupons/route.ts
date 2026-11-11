import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function adminId() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return null;
  return new Promise<number | null>((resolve) => db.get("SELECT id FROM users WHERE id = ? AND role = 'admin'", [id], (error, row: any) => resolve(error || !row ? null : Number(row.id))));
}

export async function GET() {
  if (!(await adminId())) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  return new Promise<NextResponse>((resolve) => db.all(
    `SELECT c.*, (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id) AS redemptions
     FROM coupons c ORDER BY c.created_at DESC`,
    (error, coupons) => resolve(error ? NextResponse.json({ error: "Не удалось загрузить промокоды" }, { status: 500 }) : NextResponse.json({ coupons }))
  ));
}

export async function POST(request: Request) {
  const actorId = await adminId();
  if (!actorId) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const code = String(body.code || "").trim().toUpperCase().replace(/\s+/g, "");
  const percent = Number(body.discountPercent);
  const minSubtotal = Number(body.minSubtotal || 0);
  const maxUses = body.maxUses === "" || body.maxUses == null ? null : Number(body.maxUses);
  const perUser = Number(body.maxUsesPerUser ?? 1);
  const startsAt = body.startsAt ? String(body.startsAt).slice(0, 10) : null;
  const expiresAt = body.expiresAt ? String(body.expiresAt).slice(0, 10) : null;
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return NextResponse.json({ error: "Код: 3–32 символа, латинские буквы, цифры, дефис или подчёркивание" }, { status: 400 });
  if (!Number.isFinite(percent) || percent <= 0 || percent > 80) return NextResponse.json({ error: "Скидка должна быть от 1 до 80%" }, { status: 400 });
  if (!Number.isFinite(minSubtotal) || minSubtotal < 0) return NextResponse.json({ error: "Минимальная сумма некорректна" }, { status: 400 });
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return NextResponse.json({ error: "Общий лимит должен быть положительным числом" }, { status: 400 });
  if (!Number.isInteger(perUser) || perUser < 1 || perUser > 100) return NextResponse.json({ error: "Лимит на клиента должен быть от 1 до 100" }, { status: 400 });
  if (startsAt && expiresAt && startsAt > expiresAt) return NextResponse.json({ error: "Дата начала позже даты окончания" }, { status: 400 });
  return new Promise<NextResponse>((resolve) => db.run(
    "INSERT INTO coupons (code, discount_percent, min_subtotal, max_uses, max_uses_per_user, starts_at, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [code, percent, minSubtotal, maxUses, perUser, startsAt, expiresAt, actorId],
    function (error) {
      if (error) return resolve(NextResponse.json({ error: error.message.includes("UNIQUE") ? "Такой промокод уже существует" : "Не удалось создать промокод" }, { status: error.message.includes("UNIQUE") ? 409 : 500 }));
      resolve(NextResponse.json({ ok: true, couponId: this.lastID }, { status: 201 }));
    }
  ));
}
