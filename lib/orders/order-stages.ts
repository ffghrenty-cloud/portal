export type OrderStageConfig = {
  readonly role: readonly string[];
  readonly label: string;
  readonly next?: string;
};

/** Единственный источник конфигурации этапов заказа. */
export const ORDER_STAGES: Readonly<Record<string, OrderStageConfig>> = {
  stock_check: { role: ["order_receiver"], label: "Проверка наличия на складе", next: "manager_review" },
  manager_review: { role: ["manager", "senior_manager"], label: "Проверка менеджером", next: "warehouse" },
  warehouse: { role: ["warehouse"], label: "Приёмка на складе", next: "picking" },
  picking: { role: ["warehouse"], label: "Комплектация", next: "quality_check" },
  quality_check: { role: ["quality"], label: "Контроль качества", next: "packing" },
  packing: { role: ["packer"], label: "Упаковка", next: "shipment_preparation" },
  shipment_preparation: { role: ["shipment_preparer"], label: "Подготовка и загрузка отправки", next: "shipping" },
  shipping: { role: ["logistics"], label: "Передача в доставку", next: "delivery" },
  delivery: { role: ["logistics"], label: "Доставка клиенту" },
};
