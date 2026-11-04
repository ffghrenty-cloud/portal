import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

const STAGES: Record<string, string> = {
  stock_check: "order_receiver",
  manager_review: "manager", warehouse: "warehouse", picking: "warehouse",
  quality_check: "quality", packing: "packer", shipping: "logistics", delivery: "logistics", shipment_preparation: "shipment_preparer",
};
async function currentUser() {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return null;
  return new Promise<any>((resolve) => db.get("SELECT id, role FROM users WHERE id = ?", [id], (err, row) => resolve(err ? null : row || null)));
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentUser();
  if (!actor || !["admin", "senior_manager", "manager"].includes(actor.role)) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  return new Promise<NextResponse>((resolve) => db.all(
    `SELECT t.*, u.email AS assigned_email, a.email AS assigned_by_email
     FROM order_stage_tasks t LEFT JOIN users u ON u.id = t.assigned_user_id
     LEFT JOIN users a ON a.id = t.assigned_by_user_id WHERE t.order_id = ? ORDER BY t.created_at ASC`,
    [id], (err, tasks) => resolve(err ? NextResponse.json({ error: err.message }, { status: 500 }) : NextResponse.json({ tasks }))
  ));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentUser();
  if (!actor || !["admin", "senior_manager", "manager"].includes(actor.role)) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  const { id } = await params;
  try {
    const body = await request.json();
    const stage = String(body.stage || "");
    const assignedUserId = Number(body.assignedUserId);
    const note = String(body.note || "").trim().slice(0, 1000) || null;
    const requiredRole = STAGES[stage];
    if (!requiredRole || !Number.isInteger(assignedUserId) || assignedUserId < 1) return NextResponse.json({ error: "Укажите корректный этап и сотрудника" }, { status: 400 });
    return new Promise<NextResponse>((resolve) => db.get("SELECT id FROM orders WHERE id = ?", [id], (orderErr, order) => {
      if (orderErr || !order) return resolve(NextResponse.json({ error: "Заказ не найден" }, { status: 404 }));
      db.get("SELECT id, email, role FROM users WHERE id = ?", [assignedUserId], (userErr, user: any) => {
        if (userErr || !user || (stage === "manager_review" ? !["manager", "senior_manager"].includes(user.role) : user.role !== requiredRole)) return resolve(NextResponse.json({ error: "Выбранный сотрудник не подходит для этого этапа" }, { status: 400 }));
        db.get(
          "SELECT id FROM order_stage_tasks WHERE order_id = ? AND stage = ? AND status != 'completed' AND status != 'cancelled' ORDER BY created_at DESC LIMIT 1",
          [id, stage],
          (existingErr, existing: any) => {
            if (existingErr) return resolve(NextResponse.json({ error: existingErr.message }, { status: 500 }));
            const saveTask = (taskId: number, statusCode: number) => {
              const labels: Record<string, string> = { stock_check: "Назначен приёмщик заказов", manager_review: "Назначен менеджер", shipment_preparation: "Назначен сотрудник подготовки отправки", warehouse: "Назначен сотрудник склада", picking: "Назначен комплектовщик", quality_check: "Назначен контролёр качества", packing: "Назначен упаковщик", shipping: "Назначен сотрудник логистики", delivery: "Назначен сотрудник доставки" };
              const writeEvent = () => db.run(
                "INSERT INTO order_events (order_id, status, title, description, actor_user_id) VALUES (?, (SELECT status FROM orders WHERE id = ?), ?, ?, ?)",
                [id, id, existing ? "Ответственный переназначен" : labels[stage], "Ответственный: " + user.email, actor.id],
                (eventErr) => resolve(eventErr ? NextResponse.json({ error: eventErr.message }, { status: 500 }) : NextResponse.json({ ok: true, taskId }, { status: statusCode }))
              );
              if (stage === "manager_review") {
                db.run("UPDATE orders SET manager = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [user.email, id], (managerErr) => {
                  if (managerErr) return resolve(NextResponse.json({ error: managerErr.message }, { status: 500 }));
                  writeEvent();
                });
              } else writeEvent();
            };
            if (existing) {
              db.run(
                "UPDATE order_stage_tasks SET assigned_user_id = ?, assigned_by_user_id = ?, status = 'pending', note = ?, completed_at = NULL WHERE id = ?",
                [assignedUserId, actor.id, note, existing.id],
                (updateErr) => updateErr
                  ? resolve(NextResponse.json({ error: updateErr.message }, { status: 500 }))
                  : saveTask(existing.id, 200)
              );
            } else {
              db.run(
                "INSERT INTO order_stage_tasks (order_id, stage, assigned_user_id, assigned_by_user_id, status, note) VALUES (?, ?, ?, ?, 'pending', ?)",
                [id, stage, assignedUserId, actor.id, note],
                function (taskErr) {
                  if (taskErr) return resolve(NextResponse.json({ error: taskErr.message }, { status: 500 }));
                  saveTask(this.lastID, 201);
                }
              );
            }
          }
        );
      });
    }));
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
}
