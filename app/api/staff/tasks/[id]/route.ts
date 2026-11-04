import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";
import { advanceOrderWorkflow } from "@/lib/order-automation";

const STAGE_RULES: Record<string, { role: string | string[]; orderStatus: string; title: string; allowedFrom: string[] }> = {
  stock_check: { role: "order_receiver", orderStatus: "stock_checked", title: "Наличие товаров проверено", allowedFrom: ["pending"] },
  manager_review: { role: "manager", orderStatus: "confirmed", title: "Заказ согласован менеджером", allowedFrom: ["stock_checked"] },
  warehouse: { role: "warehouse", orderStatus: "warehouse", title: "Заказ принят складом", allowedFrom: ["confirmed", "production"] },
  picking: { role: "warehouse", orderStatus: "picking", title: "Комплектация заказа завершена", allowedFrom: ["warehouse"] },
  quality_check: { role: "quality", orderStatus: "quality_check", title: "Контроль качества пройден", allowedFrom: ["picking"] },
  packing: { role: "packer", orderStatus: "packing", title: "Заказ упакован", allowedFrom: ["quality_check"] },
  shipment_preparation: { role: "shipment_preparer", orderStatus: "ready", title: "Заказ загружен и готов к отправке", allowedFrom: ["packing"] },
  shipping: { role: "logistics", orderStatus: "shipped", title: "Заказ передан в доставку", allowedFrom: ["packing", "ready"] },
  delivery: { role: "logistics", orderStatus: "delivered", title: "Заказ доставлен", allowedFrom: ["shipped"] },
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = (await cookies()).get("userId")?.value;
  if (!userId) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  const { id } = await params;
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 }); }
  const nextStatus = body.status;
  if (!["in_progress", "completed"].includes(nextStatus)) return NextResponse.json({ error: "Допустимые действия: in_progress или completed" }, { status: 400 });

  return new Promise<NextResponse>((resolve) => db.get(
    "SELECT t.*, u.role AS actor_role FROM order_stage_tasks t JOIN users u ON u.id = ? WHERE t.id = ?",
    [userId, id],
    (err, task: any) => {
      if (err || !task) return resolve(NextResponse.json({ error: "Задание не найдено" }, { status: 404 }));
      if (task.assigned_user_id !== Number(userId) && task.actor_role !== "admin") return resolve(NextResponse.json({ error: "Это задание назначено другому сотруднику" }, { status: 403 }));
      if (task.stage === "stock_check") return resolve(NextResponse.json({ error: "Для проверки наличия используйте отдельное рабочее место приёмщика" }, { status: 400 }));
      const rule = STAGE_RULES[task.stage];
      if (!rule || (task.actor_role !== "admin" && !(Array.isArray(rule.role) ? rule.role.includes(task.actor_role) : task.actor_role === rule.role) && !(task.stage === "manager_review" && task.actor_role === "senior_manager"))) return resolve(NextResponse.json({ error: "Ваша роль не может выполнять этот этап" }, { status: 403 }));
      if (task.status === "completed") return resolve(NextResponse.json({ error: "Задание уже завершено" }, { status: 409 }));

      db.get("SELECT status FROM orders WHERE id = ?", [task.order_id], (orderErr, order: any) => {
        if (orderErr || !order) return resolve(NextResponse.json({ error: "Заказ не найден" }, { status: 404 }));
        if (!rule.allowedFrom.includes(order.status)) {
          return resolve(NextResponse.json({ error: "Этот этап пока нельзя выполнить: сначала должен завершиться предыдущий этап заказа" }, { status: 409 }));
        }
        const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : task.note;
        db.run(
          "UPDATE order_stage_tasks SET status = ?, note = ?, completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?",
          [nextStatus, note, nextStatus, id],
          (updateErr) => {
            if (updateErr) return resolve(NextResponse.json({ error: updateErr.message }, { status: 500 }));
            if (nextStatus !== "completed") return resolve(NextResponse.json({ ok: true }));
            db.run("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [rule.orderStatus, task.order_id], (statusErr) => {
              if (statusErr) return resolve(NextResponse.json({ error: statusErr.message }, { status: 500 }));
              db.run(
                "INSERT INTO order_events (order_id, status, title, description, actor_user_id) VALUES (?, ?, ?, ?, ?)",
                [task.order_id, rule.orderStatus, rule.title, note || "Этап выполнен ответственным сотрудником", userId],
                async (eventErr) => {
                  if (eventErr) {
                    resolve(NextResponse.json({ error: eventErr.message }, { status: 500 }));
                    return;
                  }
                  await advanceOrderWorkflow(task.order_id, task.stage, Number(userId));
                  resolve(NextResponse.json({ ok: true }));
                }
              );
            });
          }
        );
      });
    }
  ));
}
