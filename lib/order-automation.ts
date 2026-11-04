import db from "@/lib/db";

type StageConfig = {
  role: string[];
  label: string;
  next?: string;
};

export const ORDER_STAGES: Record<string, StageConfig> = {
  manager_review: { role: ["manager", "senior_manager"], label: "Проверка менеджером", next: "warehouse" },
  warehouse: { role: ["warehouse"], label: "Приёмка на складе", next: "picking" },
  picking: { role: ["warehouse"], label: "Комплектация", next: "quality_check" },
  quality_check: { role: ["quality"], label: "Контроль качества", next: "packing" },
  packing: { role: ["packer"], label: "Упаковка", next: "shipping" },
  shipping: { role: ["logistics"], label: "Передача в доставку", next: "delivery" },
  delivery: { role: ["logistics"], label: "Доставка клиенту" },
};

export function assignStageAutomatically(
  orderId: number,
  stage: string,
  assignedByUserId: number | null = null
): Promise<void> {
  const config = ORDER_STAGES[stage];
  if (!config) return Promise.resolve();

  return new Promise((resolve) => {
    db.get(
      "SELECT id, status FROM orders WHERE id = ?",
      [orderId],
      (orderError, order: any) => {
        if (orderError || !order) return resolve();

        db.get(
          "SELECT id FROM order_stage_tasks WHERE order_id = ? AND stage = ? AND status != 'cancelled' LIMIT 1",
          [orderId, stage],
          (taskError, existing: any) => {
            if (taskError || existing) return resolve();

            const placeholders = config.role.map(() => "?").join(", ");
            db.get(
              `SELECT id, email FROM users WHERE role IN (${placeholders}) ORDER BY created_at ASC, id ASC LIMIT 1`,
              config.role,
              (staffError, staff: any) => {
                if (staffError || !staff) {
                  db.run(
                    "INSERT INTO order_events (order_id, status, title, description, actor_user_id) VALUES (?, ?, ?, ?, ?)",
                    [orderId, order.status, "Ожидает назначения сотрудника", `Этап «${config.label}»: пока нет сотрудника с нужной ролью`, assignedByUserId]
                  );
                  return resolve();
                }

                db.run(
                  "INSERT INTO order_stage_tasks (order_id, stage, assigned_user_id, assigned_by_user_id, status, note) VALUES (?, ?, ?, ?, 'pending', ?)",
                  [orderId, stage, staff.id, assignedByUserId, "Назначено системой автоматически"],
                  (insertError) => {
                    if (insertError) return resolve();
                    db.run(
                      "INSERT INTO order_events (order_id, status, title, description, actor_user_id) VALUES (?, ?, ?, ?, ?)",
                      [orderId, order.status, "Этап назначен автоматически", `«${config.label}» — ${staff.email}`, assignedByUserId]
                    );
                    resolve();
                  }
                );
              }
            );
          }
        );
      }
    );
  });
}

export function notifyOrderCustomer(
  orderId: number,
  title: string,
  message: string
): Promise<void> {
  return new Promise((resolve) => {
    db.get("SELECT user_id FROM orders WHERE id = ?", [orderId], (err, order: any) => {
      if (err || !order) return resolve();
      db.run(
        "INSERT INTO order_notifications (order_id, user_id, title, message) VALUES (?, ?, ?, ?)",
        [orderId, order.user_id, title, message],
        () => resolve()
      );
    });
  });
}

export async function advanceOrderWorkflow(
  orderId: number,
  completedStage: string,
  actorUserId: number
): Promise<void> {
  const nextStage = ORDER_STAGES[completedStage]?.next;
  const current = ORDER_STAGES[completedStage];
  if (!current) return;

  await notifyOrderCustomer(
    orderId,
    "Обновление заказа",
    `Этап «${current.label}» завершён.`
  );

  if (nextStage) {
    await assignStageAutomatically(orderId, nextStage, actorUserId);
  } else {
    await notifyOrderCustomer(orderId, "Заказ доставлен", "Заказ отмечен как доставленный. Спасибо за покупку!");
  }
}
