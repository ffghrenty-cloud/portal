import db from "@/lib/db";

export type OrderRecord = { id: number; status: string; user_id: number };
export type StaffRecord = { id: number; email: string };

type RunResult = { lastID: number; changes: number };

function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params as any[], (error, row) => {
      if (error) reject(error);
      else resolve(row as T | undefined);
    });
  });
}

function execute(sql: string, params: unknown[] = []): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    db.run(sql, params as any[], function (error) {
      if (error) reject(error);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/** Изолирует SQL и детали адаптера БД от бизнес-правил заказа. */
export class OrderWorkflowRepository {
  findOrder(orderId: number): Promise<OrderRecord | undefined> {
    return queryOne<OrderRecord>(
      "SELECT id, status, user_id FROM orders WHERE id = ?",
      [orderId]
    );
  }

  async hasActiveTask(orderId: number, stage: string): Promise<boolean> {
    const task = await queryOne<{ id: number }>(
      "SELECT id FROM order_stage_tasks WHERE order_id = ? AND stage = ? AND status != 'cancelled' LIMIT 1",
      [orderId, stage]
    );
    return Boolean(task);
  }

  findLeastBusyStaff(roles: readonly string[]): Promise<StaffRecord | undefined> {
    if (roles.length === 0) return Promise.resolve(undefined);
    const placeholders = roles.map(() => "?").join(", ");
    return queryOne<StaffRecord>(
      `SELECT u.id, u.email
       FROM users u
       LEFT JOIN order_stage_tasks t
         ON t.assigned_user_id = u.id AND t.status IN ('pending', 'in_progress')
       WHERE u.role IN (${placeholders})
       GROUP BY u.id, u.email, u.created_at
       ORDER BY COUNT(t.id) ASC, u.created_at ASC, u.id ASC
       LIMIT 1`,
      [...roles]
    );
  }

  async createTask(orderId: number, stage: string, staffId: number, actorId: number | null): Promise<void> {
    await execute(
      "INSERT INTO order_stage_tasks (order_id, stage, assigned_user_id, assigned_by_user_id, status, note) VALUES (?, ?, ?, ?, 'pending', ?)",
      [orderId, stage, staffId, actorId, "Назначено системой автоматически"]
    );
  }

  async setManager(orderId: number, email: string): Promise<void> {
    await execute("UPDATE orders SET manager = ? WHERE id = ?", [email, orderId]);
  }

  async addEvent(orderId: number, status: string, title: string, description: string, actorId: number | null): Promise<void> {
    await execute(
      "INSERT INTO order_events (order_id, status, title, description, actor_user_id) VALUES (?, ?, ?, ?, ?)",
      [orderId, status, title, description, actorId]
    );
  }

  async addNotification(orderId: number, title: string, message: string): Promise<void> {
    const order = await queryOne<{ user_id: number }>(
      "SELECT user_id FROM orders WHERE id = ?",
      [orderId]
    );
    if (!order?.user_id) return;
    await execute(
      "INSERT INTO order_notifications (order_id, user_id, title, message) VALUES (?, ?, ?, ?)",
      [orderId, order.user_id, title, message]
    );
  }
}
