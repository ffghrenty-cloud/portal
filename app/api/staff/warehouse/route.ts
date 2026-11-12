import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

async function currentUser() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return null;
  return new Promise<any>((resolve) => db.get(
    "SELECT id, role FROM users WHERE id = ?",
    [id],
    (err, row) => resolve(err ? null : row || null)
  ));
}

async function ensureMovementTable() {
  return new Promise<void>((resolve, reject) => db.run(
    `CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      note TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    (err) => err ? reject(err) : resolve()
  ));
}

export async function GET() {
  const actor = await currentUser();
  if (!actor || !["admin", "warehouse"].includes(actor.role)) {
    return NextResponse.json({ error: "Доступ разрешён только администратору или сотруднику склада" }, { status: 403 });
  }

  try {
    await ensureMovementTable();
    const [products, movements] = await Promise.all([
      new Promise<any[]>((resolve, reject) => db.all(
        "SELECT id, name, sku, category, stock_quantity FROM products ORDER BY name COLLATE NOCASE",
        (err, rows) => err ? reject(err) : resolve(rows || [])
      )),
      new Promise<any[]>((resolve, reject) => db.all(
        `SELECT sm.id, sm.product_id, p.name AS product_name, p.sku,
                sm.movement_type, sm.quantity, sm.balance_after, sm.note,
                sm.created_at, u.email AS employee
         FROM stock_movements sm
         JOIN products p ON p.id = sm.product_id
         LEFT JOIN users u ON u.id = sm.created_by
         ORDER BY sm.created_at DESC, sm.id DESC LIMIT 50`,
        (err, rows) => err ? reject(err) : resolve(rows || [])
      ))
    ]);
    return NextResponse.json({ products, movements });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить складские данные" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await currentUser();
  if (!actor || !["admin", "warehouse"].includes(actor.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const productId = Number(body.productId);
  const type = String(body.type || "");
  const quantity = Number(body.quantity);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
  if (!Number.isInteger(productId) || productId < 1 || !["receive", "writeoff", "set"].includes(type)) {
    return NextResponse.json({ error: "Выберите товар и операцию" }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 0 || (type !== "set" && quantity < 1)) {
    return NextResponse.json({ error: "Укажите корректное целое количество" }, { status: 400 });
  }
  if (quantity > 1000000) return NextResponse.json({ error: "Слишком большое количество" }, { status: 400 });

  try { await ensureMovementTable(); } catch {
    return NextResponse.json({ error: "Не удалось подготовить складской журнал" }, { status: 500 });
  }

  return new Promise<NextResponse>((resolve) => {
    db.serialize(() => {
      db.run("BEGIN", (beginError) => {
        if (beginError) return resolve(NextResponse.json({ error: "Не удалось начать складскую операцию" }, { status: 500 }));
        db.get("SELECT stock_quantity FROM products WHERE id = ?", [productId], (productError, product: any) => {
          if (productError || !product) {
            db.run("ROLLBACK", () => resolve(NextResponse.json({ error: "Товар не найден" }, { status: 404 })));
            return;
          }
          const current = Number(product.stock_quantity || 0);
          const next = type === "receive" ? current + quantity : type === "writeoff" ? current - quantity : quantity;
          if (next < 0) {
            db.run("ROLLBACK", () => resolve(NextResponse.json({ error: "Нельзя списать больше товара, чем есть на складе" }, { status: 400 })));
            return;
          }
          const delta = next - current;
          db.run("UPDATE products SET stock_quantity = ? WHERE id = ?", [next, productId], (updateError) => {
            if (updateError) {
              db.run("ROLLBACK", () => resolve(NextResponse.json({ error: "Не удалось обновить остаток" }, { status: 500 })));
              return;
            }
            db.run(
              "INSERT INTO stock_movements (product_id, movement_type, quantity, balance_after, note, created_by) VALUES (?, ?, ?, ?, ?, ?)",
              [productId, type, delta, next, note || null, actor.id],
              (insertError) => {
                if (insertError) {
                  db.run("ROLLBACK", () => resolve(NextResponse.json({ error: "Не удалось сохранить складскую операцию" }, { status: 500 })));
                  return;
                }
                db.run("COMMIT", (commitError) => {
                  if (commitError) {
                    db.run("ROLLBACK", () => resolve(NextResponse.json({ error: "Не удалось завершить складскую операцию" }, { status: 500 })));
                    return;
                  }
                  resolve(NextResponse.json({ ok: true, previousQuantity: current, stockQuantity: next, changedBy: actor.id }));
                });
              }
            );
          });
        });
      });
    });
  });
}
