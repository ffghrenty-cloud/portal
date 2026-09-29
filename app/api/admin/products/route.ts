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

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  return new Promise((resolve) => {
    db.all("SELECT * FROM products ORDER BY id DESC", (err, products) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ products }));
      }
    });
  });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const body = await request.json();
  const { name, sku, category, price, description, image_url } = body;

  if (!name || !price) {
    return NextResponse.json(
      { error: "Название и цена обязательны" },
      { status: 400 }
    );
  }

  return new Promise((resolve) => {
    db.run(
      `INSERT INTO products (name, sku, category, price, description, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, sku || null, category || null, price, description || null, image_url || null],
      function (err) {
        if (err) {
          resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ ok: true, productId: this.lastID }));
        }
      }
    );
  });
}