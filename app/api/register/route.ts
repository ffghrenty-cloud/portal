import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, company } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email и пароль обязательны" },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(password, 10);

    return new Promise((resolve) => {
      db.run(
        "INSERT INTO users (email, password, company, role) VALUES (?, ?, ?, ?)",
        [email, hash, company || null, "client"],
        function (err) {
          if (err) {
            if (err.message.includes("UNIQUE")) {
              resolve(
                NextResponse.json(
                  { error: "Пользователь с таким email уже существует" },
                  { status: 400 }
                )
              );
            } else {
              resolve(
                NextResponse.json({ error: err.message }, { status: 500 })
              );
            }
          } else {
            // ✅ Сразу ставим cookie — пользователь залогинен автоматически
            const response = NextResponse.json({
              ok: true,
              userId: this.lastID,
              message: "Регистрация успешна",
            });

            response.cookies.set("userId", String(this.lastID), {
              httpOnly: true,
              maxAge: 60 * 60 * 24 * 30, // 30 дней
              path: "/",
              sameSite: "lax",
            });

            response.cookies.set("userRole", "client", {
              httpOnly: true,
              maxAge: 60 * 60 * 24 * 30,
              path: "/",
              sameSite: "lax",
            });

            resolve(response);
          }
        }
      );
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}