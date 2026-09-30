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
    db.run(
      "DELETE FROM admin_messages WHERE user_id = ?",
      [userId],
      function (err) {
        if (err) {
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ ok: true, deleted: this.changes }));
        }
      }
    );
  });
}