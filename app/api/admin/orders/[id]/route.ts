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

const ALLOWED_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "production",
  "ready",
  "shipped",
  "cancelled",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, manager } = body;

  if (status && !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 });
  }

  return new Promise((resolve) => {
    const updates: string[] = [];
    const values: any[] = [];

    if (status) {
      updates.push("status = ?");
      values.push(status);
    }
    if (manager !== undefined) {
      updates.push("manager = ?");
      values.push(manager);
    }
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    db.run(
      `UPDATE orders SET ${updates.join(", ")} WHERE id = ?`,
      values,
      function (err) {
        if (err) {
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ ok: true, changes: this.changes }));
        }
      }
    );
  });
}