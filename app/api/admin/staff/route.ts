import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { assignStageAutomatically } from "@/lib/order-automation";

const STAFF_ROLES = ["manager", "senior_manager", "warehouse", "quality", "packer", "logistics"];

async function currentUser() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return null;
  return new Promise<any>((resolve) => db.get("SELECT id, role FROM users WHERE id = ?", [id], (err, row) => resolve(err ? null : row || null)));
}

export async function GET() {
  const actor = await currentUser();
  if (!actor || actor.role !== "admin") return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  return new Promise((resolve) => db.all(
    "SELECT id, email, company, role, created_at FROM users WHERE role IN ('admin','manager','senior_manager','warehouse','quality','packer','logistics') ORDER BY created_at DESC",
    (err, staff) => resolve(err ? NextResponse.json({ error: err.message }, { status: 500 }) : NextResponse.json({ staff }))
  ));
}

export async function POST(request: Request) {
  const actor = await currentUser();
  if (!actor || actor.role !== "admin") return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "");
    const company = String(body.company || "").trim() || null;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Пароль должен содержать минимум 8 символов" }, { status: 400 });
    if (!STAFF_ROLES.includes(role)) return NextResponse.json({ error: "Недопустимая роль сотрудника" }, { status: 400 });
    const hash = await bcrypt.hash(password, 10);
    return new Promise((resolve) => db.run(
      "INSERT INTO users (email, password, company, role) VALUES (?, ?, ?, ?)",
      [email, hash, company, role],
      function (err) {
        if (err) return resolve(NextResponse.json({ error: err.message.includes("UNIQUE") ? "Пользователь с таким email уже существует" : err.message }, { status: err.message.includes("UNIQUE") ? 409 : 500 }));
        const staffId = this.lastID;
        if (role === "manager" || role === "senior_manager") {
          db.all("SELECT id FROM orders WHERE status = 'pending' ORDER BY created_at ASC", (ordersError, orders: any[]) => {
            if (!ordersError && orders) {
              for (const order of orders) void assignStageAutomatically(order.id, "manager_review", staffId);
            }
          });
        }
        resolve(NextResponse.json({ ok: true, staff: { id: staffId, email, company, role } }, { status: 201 }));
      }
    ));
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
}
