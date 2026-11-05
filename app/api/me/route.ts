import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("userId")?.value;

    if (!userId) {
      return NextResponse.json(
        { user: null, error: "Сессия не найдена" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    return await new Promise<NextResponse>((resolve) => {
      db.get(
        "SELECT id, email, role, company FROM users WHERE id = ?",
        [userId],
        (err, user) => {
          if (err) {
            console.error("Ошибка проверки сессии пользователя:", err);
            resolve(
              NextResponse.json(
                { user: null, error: "Не удалось проверить сессию" },
                { status: 500, headers: { "Cache-Control": "no-store" } }
              )
            );
            return;
          }

          if (!user) {
            resolve(
              NextResponse.json(
                { user: null, error: "Пользователь не найден" },
                { status: 401, headers: { "Cache-Control": "no-store" } }
              )
            );
            return;
          }

          resolve(
            NextResponse.json(
              { user },
              { headers: { "Cache-Control": "no-store" } }
            )
          );
        }
      );
    });
  } catch (error) {
    console.error("Ошибка получения текущего пользователя:", error);
    return NextResponse.json(
      { user: null, error: "Ошибка проверки авторизации" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
