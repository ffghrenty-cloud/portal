import { NotificationRepository, type OrderNotification } from "./notification.repository";

export type NotificationList = {
  notifications: OrderNotification[];
  unreadCount: number;
};

/** Service: объединяет операции репозитория в сценарии приложения. */
export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async listForUser(userId: number): Promise<NotificationList> {
    const [notifications, unreadCount] = await Promise.all([
      this.repository.findForUser(userId),
      this.repository.countUnread(userId),
    ]);
    return { notifications, unreadCount };
  }

  async markAsRead(userId: number, notificationId: number): Promise<boolean> {
    return (await this.repository.markOneAsRead(userId, notificationId)) > 0;
  }

  markAllAsRead(userId: number): Promise<number> {
    return this.repository.markAllAsRead(userId);
  }
}

export const notificationService = new NotificationService(new NotificationRepository());
