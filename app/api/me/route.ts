import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) {
    return NextResponse.json({ user: null });
  }

  return new Promise((resolve) => {
    db.get(
      "SELECT id, email, role, company FROM users WHERE id = ?",
      [userId],
      (err, user) => {
        if (err || !user) {
          resolve(NextResponse.json({ user: null }));
        } else {
          resolve(NextResponse.json({ user }));
        }
      }
    );
  });
}