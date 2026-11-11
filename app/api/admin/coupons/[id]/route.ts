import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function isAdmin() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return false;
  return new Promise<boolean>((resolve) => db.get("SELECT id FROM users WHERE id = ? AND role = 'admin'", [id], (error, row) => resolve(!error && Boolean(row))));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const active = body.isActive === true ? 1 : body.isActive === false ? 0 : null;
  if (active === null) return NextResponse.json({ error: "Укажите состояние промокода" }, { status: 400 });
  return new Promise<NextResponse>((resolve) => db.run("UPDATE coupons SET is_active = ? WHERE id = ?", [active, id], function (error) {
    if (error) return resolve(NextResponse.json({ error: "Не удалось обновить промокод" }, { status: 500 }));
    if (!this.changes) return resolve(NextResponse.json({ error: "Промокод не найден" }, { status: 404 }));
    resolve(NextResponse.json({ ok: true }));
  }));
}
