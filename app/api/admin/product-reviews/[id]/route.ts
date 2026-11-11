import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function isAdmin() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return false;
  return new Promise<boolean>((resolve) => db.get("SELECT role FROM users WHERE id = ?", [id], (error, row: any) => resolve(!error && row?.role === "admin")));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const status = body.status;
  const reply = typeof body.reply === "string" ? body.reply.trim().slice(0, 2000) : null;
  if (status !== undefined && !["pending", "approved", "rejected"].includes(status)) return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 });
  if (reply !== null && !reply) return NextResponse.json({ error: "Ответ не может быть пустым" }, { status: 400 });
  if (status === undefined && reply === null) return NextResponse.json({ error: "Нет изменений" }, { status: 400 });

  const updates: string[] = [];
  const values: any[] = [];
  if (status !== undefined) { updates.push("status = ?"); values.push(status); }
  if (reply !== null) { updates.push("admin_reply = ?", "replied_at = CURRENT_TIMESTAMP"); values.push(reply); }
  values.push(id);
  return new Promise<NextResponse>((resolve) => db.run(
    `UPDATE product_reviews SET ${updates.join(", ")} WHERE id = ?`,
    values,
    function (error) {
      if (error) return resolve(NextResponse.json({ error: "Не удалось обновить отзыв" }, { status: 500 }));
      if (!this.changes) return resolve(NextResponse.json({ error: "Отзыв не найден" }, { status: 404 }));
      resolve(NextResponse.json({ ok: true }));
    }
  ));
}
