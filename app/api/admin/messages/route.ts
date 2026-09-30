import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return false;

  return new Promise((resolve) => {
    db.get("SELECT role FROM users WHERE id = ?", [userId], (err, row: any) => {
      resolve(!err && row && row.role === "admin");
    });
  });
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  return new Promise((resolve) => {
    db.all(
      `SELECT m.id, m.user_id, m.text, m.is_from_admin, m.is_read, m.created_at,
              u.email as user_email, u.company as user_company
       FROM admin_messages m
       LEFT JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at DESC`,
      (err, rows) => {
        if (err)
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        else resolve(NextResponse.json({ messages: rows }));
      }
    );
  });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, text } = body;

  if (!userId || !text) {
    return NextResponse.json({ error: "Нет данных" }, { status: 400 });
  }

  return new Promise((resolve) => {
    db.run(
      `INSERT INTO admin_messages (user_id, text, is_from_admin)
       VALUES (?, ?, 1)`,
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