import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  const allowed = await new Promise<boolean>((resolve) => db.get("SELECT role FROM users WHERE id = ?", [userId], (err, user: any) => resolve(!err && user?.role === "admin")));
  if (!allowed) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const reply = typeof body.reply === "string" ? body.reply.trim().slice(0, 2000) : "";
  if (!reply) return NextResponse.json({ error: "Введите ответ на отзыв" }, { status: 400 });
  return new Promise<NextResponse>((resolve) => db.run(
    "UPDATE order_reviews SET admin_reply = ?, replied_at = CURRENT_TIMESTAMP WHERE id = ?",
    [reply, id],
    function (err) {
      if (err) return resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      if (!this.changes) return resolve(NextResponse.json({ error: "Отзыв не найден" }, { status: 404 }));
      resolve(NextResponse.json({ ok: true }));
    }
  ));
}
