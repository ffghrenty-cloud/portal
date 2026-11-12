import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { createSessionToken } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const company = typeof body.company === "string" ? body.company.trim().slice(0, 160) : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Пароль должен содержать от 8 до 128 символов" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);
    return new Promise<NextResponse>((resolve) => {
      db.run(
        "INSERT INTO users (email, password, company, role) VALUES (?, ?, ?, 'client')",
        [email, hash, company || null],
        async function (err) {
          if (err) {
            const duplicate = err.message.includes("UNIQUE");
            return resolve(NextResponse.json(
              { error: duplicate ? "Пользователь с таким email уже существует" : "Не удалось создать аккаунт" },
              { status: duplicate ? 409 : 500 }
            ));
          }

          try {
            const userId = this.lastID;
            const session = await createSessionToken(userId);
            const response = NextResponse.json({
              ok: true,
              user: { id: userId, email, role: "client", company: company || null },
              message: "Регистрация успешна",
            }, { status: 201 });
            const cookieOptions = {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              maxAge: 60 * 60 * 24 * 30,
              path: "/",
              sameSite: "lax" as const,
            };
            response.cookies.set("userId", String(userId), cookieOptions);
            response.cookies.set("userRole", "client", cookieOptions);
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
