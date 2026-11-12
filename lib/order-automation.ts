import { ORDER_STAGES } from "@/lib/orders/order-stages";
import { OrderWorkflowRepository } from "@/lib/orders/order-workflow.repository";
import { OrderWorkflowService } from "@/lib/orders/order-workflow.service";

export { ORDER_STAGES } from "@/lib/orders/order-stages";
export type { OrderStageConfig } from "@/lib/orders/order-stages";

/**
 * Совместимый фасад для старых API-маршрутов.
 * Новая бизнес-логика находится в OrderWorkflowService,
 * SQL-запросы — в OrderWorkflowRepository.
 */
const workflow = new OrderWorkflowService(new OrderWorkflowRepository());

export function assignStageAutomatically(
  orderId: number,
  stage: string,
  assignedByUserId: number | null = null
): Promise<void> {
  return workflow.assignStage(orderId, stage, assignedByUserId).catch((error) => {
    console.error("Ошибка автоматического назначения этапа:", error);
  });
}

export function notifyOrderCustomer(
  orderId: number,
  title: string,
  message: string
): Promise<void> {
  return workflow.notifyCustomer(orderId, title, message).catch((error) => {
    console.error("Ошибка создания уведомления:", error);
  });
}

export function advanceOrderWorkflow(
  orderId: number,
  completedStage: string,
  actorUserId: number
): Promise<void> {
  return workflow.advance(orderId, completedStage, actorUserId).catch((error) => {
    console.error("Ошибка перехода на следующий этап:", error);
  });
}
