import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("userId")?.value ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401, headers: { "Cache-Control": "no-store" } });

  return new Promise<NextResponse>((resolve) => {
    db.all(
      `SELECT n.id, n.order_id, n.title, n.message, n.is_read, n.created_at,
              o.status AS order_status
       FROM order_notifications n
       LEFT JOIN orders o ON o.id = n.order_id AND o.user_id = n.user_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT 100`,
      [userId],
      (err, rows: any[]) => {
        if (err) {
          console.error("Ошибка загрузки уведомлений:", err);
          resolve(NextResponse.json({ error: "Не удалось загрузить уведомления" }, { status: 500 }));
          return;
        }
        resolve(NextResponse.json({
          notifications: rows,
          unreadCount: rows.filter((item) => !item.is_read).length,
        }, { headers: { "Cache-Control": "no-store" } }));
      }
    );
  });
}

export async function PATCH(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  let body: { id?: number; all?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (body.all === true) {
    return new Promise<NextResponse>((resolve) => {
      db.run(
        "UPDATE order_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
        [userId],
        function (err) {
          if (err) resolve(NextResponse.json({ error: "Не удалось обновить уведомления" }, { status: 500 }));
          else resolve(NextResponse.json({ ok: true, updated: this.changes }));
        }
      );
    });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Укажите уведомление" }, { status: 400 });
  }

  return new Promise<NextResponse>((resolve) => {
    db.run(
      "UPDATE order_notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
      [id, userId],
      function (err) {
        if (err) resolve(NextResponse.json({ error: "Не удалось отметить уведомление" }, { status: 500 }));
        else if (this.changes === 0) resolve(NextResponse.json({ error: "Уведомление не найдено" }, { status: 404 }));
        else resolve(NextResponse.json({ ok: true }));
      }
    );
  });
}
