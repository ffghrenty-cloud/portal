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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;

  return new Promise((resolve) => {
    db.run(
      "DELETE FROM admin_messages WHERE id = ? AND is_from_admin = 1",
      [id],
      function (err) {
        if (err) {
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        } else if (this.changes === 0) {
          resolve(
            NextResponse.json(
              { error: "Сообщение не найдено" },
              { status: 404 }
            )
          );
        } else {
          resolve(NextResponse.json({ ok: true }));
        }
      }
    );
  });
}