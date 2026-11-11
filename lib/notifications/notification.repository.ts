import db from "@/lib/db";

export type OrderNotification = {
  id: number;
  order_id: number;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
  order_status: string | null;
};

function queryAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params as any[], (error, rows: any[]) => {
      if (error) reject(error);
      else resolve((rows || []) as T[]);
    });
  });
}

function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params as any[], (error, row: any) => {
      if (error) reject(error);
      else resolve(row as T | undefined);
    });
  });
}

function execute(sql: string, params: unknown[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(sql, params as any[], function (error) {
      if (error) reject(error);
      else resolve(this.changes);
    });
  });
}

/** Repository: отвечает только за чтение и изменение записей уведомлений. */
export class NotificationRepository {
  async findForUser(userId: number, limit = 100): Promise<OrderNotification[]> {
    return queryAll<OrderNotification>(
      `SELECT n.id, n.order_id, n.title, n.message, n.is_read, n.created_at,
              o.status AS order_status
       FROM order_notifications n
       LEFT JOIN orders o ON o.id = n.order_id AND o.user_id = n.user_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ?`,
      [userId, Math.min(Math.max(limit, 1), 100)]
    );
  }

  async countUnread(userId: number): Promise<number> {
    const row = await queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM order_notifications WHERE user_id = ? AND is_read = 0",
      [userId]
    );
    return Number(row?.count || 0);
  }

  markOneAsRead(userId: number, notificationId: number): Promise<number> {
    return execute(
      "UPDATE order_notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND is_read = 0",
      [notificationId, userId]
    );
  }

  markAllAsRead(userId: number): Promise<number> {
    return execute(
      "UPDATE order_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
      [userId]
    );
  }
}
