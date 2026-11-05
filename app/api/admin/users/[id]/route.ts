import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function isAdmin() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return false;
  return new Promise<boolean>((resolve) => db.get("SELECT role FROM users WHERE id = ?", [id], (err, user: any) => resolve(!err && user?.role === "admin")));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const percent = Number(body.discountPercent);
  const validUntil = body.discountValidUntil ? String(body.discountValidUntil).slice(0, 10) : null;
  if (!Number.isFinite(percent) || percent < 0 || percent > 80) return NextResponse.json({ error: "Скидка должна быть от 0 до 80 процентов" }, { status: 400 });
  if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return NextResponse.json({ error: "Некорректная дата окончания скидки" }, { status: 400 });
  return new Promise<NextResponse>((resolve) => db.run(
    "UPDATE users SET discount_percent = ?, discount_valid_until = ? WHERE id = ? AND role = 'client'",
    [percent, validUntil, id],
    function (err) {
      if (err) return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      if (!this.changes) return resolve(NextResponse.json({ error: "Клиент не найден" }, { status: 404 }));
      resolve(NextResponse.json({ ok: true, discountPercent: percent, discountValidUntil: validUntil }));
    }
  ));
}
