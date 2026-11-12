import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import db from "@/lib/db";

const STAGES: Record<string, string> = {
  stock_check: "order_receiver",
  manager_review: "manager",
  warehouse: "warehouse",
  picking: "warehouse",
  quality_check: "quality",
  packing: "packer",
  shipping: "logistics",
  delivery: "logistics",
  shipment_preparation: "shipment_preparer",
};

type Actor = { id: number; email: string; role: string };

async function currentUser(): Promise<Actor | null> {
  const id = (await cookies()).get("userId")?.value;
  if (!id) return null;
  return new Promise((resolve) => db.get(
    "SELECT id, email, role FROM users WHERE id = ?",
    [id],
    (err, row) => resolve(err ? null : (row as Actor | undefined) || null)
  ));
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentUser();
  if (!actor || !["admin", "senior_manager", "manager"].includes(actor.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  if (!/^\\d+$/.test(id)) return NextResponse.json({ error: "Некорректный заказ" }, { status: 400 });

  const scope = actor.role === "manager"
    ? "AND (o.manager = ? OR EXISTS (SELECT 1 FROM order_stage_tasks own WHERE own.order_id = o.id AND own.stage = 'manager_review' AND own.assigned_user_id = ? AND own.status IN ('pending', 'in_progress')))"
    : "";
  const values = actor.role === "manager" ? [id, actor.email, actor.id] : [id];

  return new Promise<NextResponse>((resolve) => db.all(
    `SELECT t.*, u.email AS assigned_email, a.email AS assigned_by_email
     FROM order_stage_tasks t
     LEFT JOIN users u ON u.id = t.assigned_user_id
     LEFT JOIN users a ON a.id = t.assigned_by_user_id
     JOIN orders o ON o.id = t.order_id
     WHERE t.order_id = ? ${scope}
     ORDER BY t.created_at ASC, t.id ASC`,
    values,
    (err, tasks) => resolve(err
      ? NextResponse.json({ error: "Не удалось загрузить задания заказа" }, { status: 500 })
      : NextResponse.json({ tasks }))
  ));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentUser();
  if (!actor || !["admin", "senior_manager", "manager"].includes(actor.role)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const { id } = await params;
  if (!/^\\d+$/.test(id)) return NextResponse.json({ error: "Некорректный заказ" }, { status: 400 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const stage = String(body.stage || "");
  const assignedUserId = Number(body.assignedUserId);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) || null : null;
  const requiredRole = STAGES[stage];

  if (!requiredRole || !Number.isInteger(assignedUserId) || assignedUserId < 1) {
    return NextResponse.json({ error: "Укажите корректный этап и сотрудника" }, { status: 400 });
  }
  if (actor.role === "manager" && stage === "manager_review") {
    return NextResponse.json({ error: "Переназначать менеджера может только старший менеджер или администратор" }, { status: 403 });
  }

  return new Promise<NextResponse>((resolve) => {
    db.serialize(() => {
      db.run("BEGIN IMMEDIATE", (beginError) => {
        if (beginError) return resolve(NextResponse.json({ error: "Не удалось начать операцию назначения" }, { status: 500 }));

        const rollback = (message: string, status = 500) => {
          db.run("ROLLBACK", () => resolve(NextResponse.json({ error: message }, { status })));
        };

        db.get("SELECT id, status, manager FROM orders WHERE id = ?", [id], (orderError, order: any) => {
          if (orderError) return rollback("Не удалось загрузить заказ");
          if (!order) return rollback("Заказ не найден", 404);

          const checkActorAccess = (allowed: boolean) => {
            if (!allowed) return rollback("Менеджер может назначать сотрудников только на закреплённые за ним заказы", 403);
            if (stage === "manager_review" && order.status !== "stock_checked") {
              return rollback("Назначить менеджера можно после проверки наличия товаров приёмщиком", 409);
            }

            db.get("SELECT id, email, role FROM users WHERE id = ?", [assignedUserId], (userError, user: any) => {
              const validRole = stage === "manager_review"
                ? user && ["manager", "senior_manager"].includes(user.role)
                : user && user.role === requiredRole;
              if (userError || !validRole) return rollback("Выбранный сотрудник не подходит для этого этапа", 400);

              db.get(
                "SELECT id, assigned_user_id FROM order_stage_tasks WHERE order_id = ? AND stage = ? AND status NOT IN ('completed', 'cancelled') ORDER BY created_at DESC, id DESC LIMIT 1",
                [id, stage],
                (taskError, existing: any) => {
                  if (taskError) return rollback("Не удалось проверить текущее назначение");

                  const finish = (taskId: number, statusCode: number) => {
                    const saveManager = (callback: () => void) => {
                      if (stage !== "manager_review") return callback();
                      db.run("UPDATE orders SET manager = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [user.email, id], (managerError) => {
                        if (managerError) return rollback("Не удалось обновить ответственного менеджера");
                        callback();
                      });
                    };

                    saveManager(() => {
                      const title = existing ? "Ответственный переназначен" : stage === "manager_review" ? "Назначен менеджер" : "Назначен ответственный сотрудник";
                      const description = `Этап: ${stage}. Ответственный: ${user.email}. Назначил: ${actor.email}.`;
                      db.run(
                        "INSERT INTO order_events (order_id, status, title, description, actor_user_id) VALUES (?, (SELECT status FROM orders WHERE id = ?), ?, ?, ?)",
                        [id, id, title, description, actor.id],
                        (eventError) => {
                          if (eventError) return rollback("Не удалось записать историю назначения");
                          db.run("COMMIT", (commitError) => {
                            if (commitError) return rollback("Не удалось завершить назначение");
                            resolve(NextResponse.json({ ok: true, taskId, assignedEmail: user.email, reassigned: Boolean(existing) }, { status: statusCode }));
                          });
                        }
                      );
                    });
                  };

                  if (existing) {
                    db.run(
                      "UPDATE order_stage_tasks SET assigned_user_id = ?, assigned_by_user_id = ?, status = CASE WHEN assigned_user_id = ? THEN status ELSE 'pending' END, note = ?, completed_at = NULL WHERE id = ?",
                      [assignedUserId, actor.id, assignedUserId, note, existing.id],
                      (updateError) => updateError
                        ? rollback("Не удалось обновить назначение")
                        : finish(Number(existing.id), 200)
                    );
                  } else {
                    db.run(
                      "INSERT INTO order_stage_tasks (order_id, stage, assigned_user_id, assigned_by_user_id, status, note) VALUES (?, ?, ?, ?, 'pending', ?)",
                      [id, stage, assignedUserId, actor.id, note],
                      function (insertError) {
                        if (insertError) return rollback("Не удалось создать задание");
                        finish(this.lastID, 201);
                      }
                    );
                  }
                }
              );
            });
          };

          if (actor.role !== "manager") return checkActorAccess(true);
          db.get(
            "SELECT id FROM order_stage_tasks WHERE order_id = ? AND stage = 'manager_review' AND assigned_user_id = ? AND status IN ('pending', 'in_progress') LIMIT 1",
            [id, actor.id],
            (accessError, ownTask: any) => {
              if (accessError) return rollback("Не удалось проверить права на заказ");
              checkActorAccess(order.manager === actor.email || Boolean(ownTask));
            }
          );
        });
      });
    });
  });
}
