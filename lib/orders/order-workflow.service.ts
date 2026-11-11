import { ORDER_STAGES } from "./order-stages";
import { OrderWorkflowRepository } from "./order-workflow.repository";

/** Сценарии жизненного цикла заказа. Репозиторий отвечает только за хранение. */
export class OrderWorkflowService {
  constructor(private readonly repository: OrderWorkflowRepository) {}

  async assignStage(orderId: number, stage: string, actorId: number | null = null): Promise<void> {
    const config = ORDER_STAGES[stage];
    if (!config) return;

    const order = await this.repository.findOrder(orderId);
    if (!order || await this.repository.hasActiveTask(orderId, stage)) return;

    const staff = await this.repository.findLeastBusyStaff(config.role);
    if (!staff) {
      const message = `Этап «${config.label}» ожидает назначения сотрудника.`;
      await this.repository.addEvent(orderId, order.status, "Ожидает назначения сотрудника", message, actorId);
      await this.notifySafely(orderId, "Ожидает назначения", message);
      return;
    }

    await this.repository.createTask(orderId, stage, staff.id, actorId);
    if (stage === "manager_review") {
      await this.repository.setManager(orderId, staff.email);
    }

    await this.repository.addEvent(
      orderId,
      order.status,
      "Этап назначен автоматически",
      `«${config.label}» — ${staff.email}`,
      actorId
    );
    await this.notifySafely(
      orderId,
      "Заказ передан на следующий этап",
      `Заказ передан на этап «${config.label}». Работа продолжится после принятия задания ответственным сотрудником.`
    );
  }

  notifyCustomer(orderId: number, title: string, message: string): Promise<void> {
    return this.repository.addNotification(orderId, title, message);
  }

  async advance(orderId: number, completedStage: string, actorId: number): Promise<void> {
    const current = ORDER_STAGES[completedStage];
    if (!current) return;

    if (!current.next) {
      await this.notifySafely(orderId, "Заказ доставлен", "Заказ отмечен как доставленный. Спасибо за покупку!");
      return;
    }

    const next = ORDER_STAGES[current.next];
    await this.notifySafely(
      orderId,
      "Обновление заказа",
      `Этап «${current.label}» завершён. Следующий этап: «${next.label}».`
    );
    await this.assignStage(orderId, current.next, actorId);
  }

  private async notifySafely(orderId: number, title: string, message: string): Promise<void> {
    try {
      await this.notifyCustomer(orderId, title, message);
    } catch (error) {
      // Сбой уведомлений не должен блокировать производственный процесс.
      console.error("Не удалось отправить уведомление клиенту:", error);
    }
  }
}
