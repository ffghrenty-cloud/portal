import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { createSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
      return NextResponse.json({ error: "Введите email и пароль" }, { status: 400 });
    }

    return new Promise<NextResponse>((resolve) => {
      db.get(
        "SELECT * FROM users WHERE email = ?",
        [email],
        async (err, user: any) => {
          if (err) return resolve(NextResponse.json({ error: "Не удалось выполнить вход" }, { status: 500 }));
          if (!user || !(await bcrypt.compare(password, user.password))) {
            return resolve(NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 }));
          }

          try {
            const response = NextResponse.json({
              ok: true,
              user: { id: user.id, email: user.email, role: user.role, company: user.company },
            });
            const session = await createSessionToken(user.id);
            const cookieOptions = {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              maxAge: 60 * 60 * 24 * 30,
              path: "/",
              sameSite: "lax" as const,
            };
            response.cookies.set("userId", String(user.id), cookieOptions);
            response.cookies.set("userRole", user.role, cookieOptions);
            response.cookies.set("session", session, cookieOptions);
            resolve(response);
          } catch (sessionError) {
            console.error("Не удалось создать сессию:", sessionError);
            resolve(NextResponse.json({ error: "Сервер не настроен для безопасной авторизации" }, { status: 500 }));
          }
        }
      );
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Некорректный запрос" }, { status: 400 });
  }
}
