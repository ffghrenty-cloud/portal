import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export async function POST() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  return new Promise((resolve) => {
    db.get(
      "SELECT role FROM users WHERE id = ?",
      [userId],
      (err, user: any) => {
        if (err || !user || user.role !== "admin") {
          return resolve(
            NextResponse.json({ error: "Доступ запрещён" }, { status: 403 })
          );
        }

        db.run(
          `UPDATE admin_messages SET is_read = 1
           WHERE is_from_admin = 0`,
          (err2) => {
            if (err2) {
              resolve(
                NextResponse.json({ error: err2.message }, { status: 500 })
              );
            } else {
              resolve(NextResponse.json({ ok: true }));
            }
          }
        );
      }
    );
  });
}