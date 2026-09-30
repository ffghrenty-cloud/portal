import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) {
    return NextResponse.json({ messages: [] });
  }

  return new Promise((resolve) => {
    db.all(
      `SELECT id, text, is_from_admin, created_at
       FROM admin_messages
       WHERE user_id = ?
       ORDER BY created_at ASC`,
      [userId],
      (err, rows) => {
        if (err) resolve(NextResponse.json({ messages: [] }));
        else resolve(NextResponse.json({ messages: rows }));
      }
    );
  });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) {
    return NextResponse.json(
      { error: "Нужно войти в аккаунт" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { text } = body;

  if (!text || !text.trim()) {
    return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
  }

  return new Promise((resolve) => {
    db.run(
      `INSERT INTO admin_messages (user_id, text, is_from_admin)
       VALUES (?, ?, 0)`,
      [userId, text.trim()],
      function (err) {
        if (err) {
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ ok: true, id: this.lastID }));
        }
      }
    );
  });
}