import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    return new Promise((resolve) => {
      db.get(
        'SELECT * FROM users WHERE email = ?',
        [email],
        async (err, user: any) => {
          if (err) {
            return resolve(
              NextResponse.json({ error: err.message }, { status: 500 })
            );
          }

          if (!user) {
            return resolve(
              NextResponse.json(
                { error: 'Неверный email или пароль' },
                { status: 401 }
              )
            );
          }

          const valid = await bcrypt.compare(password, user.password);
          if (!valid) {
            return resolve(
              NextResponse.json(
                { error: 'Неверный email или пароль' },
                { status: 401 }
              )
            );
          }

          const response = NextResponse.json({
            ok: true,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              company: user.company,
            },
          });

          response.cookies.set('userId', String(user.id), {
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
          });
          response.cookies.set('userRole', user.role, {
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
          });

          resolve(response);
        }
      );
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}