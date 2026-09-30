import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return NextResponse.json({ count: 0 });

  return new Promise((resolve) => {
    db.get(
      "SELECT role FROM users WHERE id = ?",
      [userId],
      (err, user: any) => {
        if (err || !user || user.role !== "admin") {
          return resolve(NextResponse.json({ count: 0 }));
        }

        db.get(
          `SELECT COUNT(*) as count FROM admin_messages
           WHERE is_from_admin = 0 AND is_read = 0`,
          (err2, row: any) => {
            if (err2) resolve(NextResponse.json({ count: 0 }));
            else resolve(NextResponse.json({ count: row.count }));
          }
        );
      }
    );
  });
}