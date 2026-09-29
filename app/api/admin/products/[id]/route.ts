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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, sku, category, price, description, image_url } = body;

  return new Promise((resolve) => {
    db.run(
      `UPDATE products
       SET name = ?, sku = ?, category = ?, price = ?, description = ?, image_url = ?
       WHERE id = ?`,
      [name, sku || null, category || null, price, description || null, image_url || null, id],
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;

  return new Promise((resolve) => {
    db.run("DELETE FROM products WHERE id = ?", [id], function (err) {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ ok: true, changes: this.changes }));
      }
    });
  });
}