import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

const STAGE_RULES: Record<string, { role: string; orderStatus: string; title: string }> = {
  manager_review: { role: "manager", orderStatus: "confirmed", title: "Заказ согласован менеджером" },
  warehouse: { role: "warehouse", orderStatus: "warehouse", title: "Заказ принят складом" },
  picking: { role: "warehouse", orderStatus: "picking", title: "Комплектация заказа завершена" },
  quality_check: { role: "quality", orderStatus: "quality_check", title: "Контроль качества пройден" },
  packing: { role: "packer", orderStatus: "packing", title: "Заказ упакован" },
  shipping: { role: "logistics", orderStatus: "shipped", title: "Заказ передан в доставку" },
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  const { id } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const nextStatus = body.status;
  if (!["in_progress", "completed"].includes(nextStatus)) return NextResponse.json({ error: "Допустимые действия: in_progress или completed" }, { status: 400 });

  return new Promise((resolve) => db.get(
    "SELECT t.*, u.role AS actor_role FROM order_stage_tasks t JOIN users u ON u.id = ? WHERE t.id = ?",
    [userId, id],
    (err, task: any) => {
      if (err || !task) return resolve(NextResponse.json({ error: "Задание не найдено" }, { status: 404 }));
      if (task.assigned_user_id !== Number(userId) && task.actor_role !== "admin") return resolve(NextResponse.json({ error: "Это задание назначено другому сотруднику" }, { status: 403 }));
      const rule = STAGE_RULES[task.stage];
      if (!rule || (task.actor_role !== "admin" && task.actor_role !== rule.role)) return resolve(NextResponse.json({ error: "Ваша роль не может выполнять этот этап" }, { status: 403 }));
      if (task.status === "completed") return resolve(NextResponse.json({ error: "Задание уже завершено" }, { status: 409 }));
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : task.note;
      db.run(
        "UPDATE order_stage_tasks SET status = ?, note = ?, completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?",
        [nextStatus, note, nextStatus, id],
        (updateErr) => {
          if (updateErr) return resolve(NextResponse.json({ error: updateErr.message }, { status: 500 }));
          if (nextStatus !== "completed") return resolve(NextResponse.json({ ok: true }));
          db.run("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [rule.orderStatus, task.order_id], (orderErr) => {
            if (orderErr) return resolve(NextResponse.json({ error: orderErr.message }, { status: 500 }));
            db.run(
              "INSERT INTO order_events (order_id, status, title, description, actor_user_id) VALUES (?, ?, ?, ?, ?)",
              [task.order_id, rule.orderStatus, rule.title, note || "Этап выполнен ответственным сотрудником", userId],
              (eventErr) => resolve(eventErr ? NextResponse.json({ error: eventErr.message }, { status: 500 }) : NextResponse.json({ ok: true }))
            );
          });
        }
      );
    }
  ));
}
