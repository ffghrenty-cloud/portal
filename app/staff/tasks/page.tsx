"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ShipmentItem = {
  id: number;
  product_name: string;
  quantity: number;
  available_quantity: number | null;
  stock_quantity: number;
  shipped_quantity: number;
  sku: string | null;
  price: number;
};
type Task = {
  id: number; order_id: number; stage: string; task_status: string; note: string | null;
  created_at: string; order_status: string; total: number; contact_name: string | null;
  contact_phone: string | null; customer_email: string; customer_company: string | null;
  items: ShipmentItem[];
};
type ShipmentDraft = { quantities: Record<number, number>; carrier: string; trackingNumber: string; note: string };
const STAGES: Record<string, string> = {
  manager_review: "Проверка менеджером", warehouse: "Приёмка на складе", picking: "Комплектация",
  quality_check: "Контроль качества", packing: "Упаковка", shipment_preparation: "Подготовка и загрузка отправки", shipping: "Отгрузка и логистика", delivery: "Доставка клиенту",
};
const maxShippable = (item: ShipmentItem) => Math.max(0, Math.min(
  Number(item.quantity) - Number(item.shipped_quantity),
  Number(item.available_quantity ?? 0) - Number(item.shipped_quantity),
  Number(item.stock_quantity)
));
const money = (value: number) => Number(value || 0).toFixed(2).replace(".", ",");

export default function StaffTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [shipmentDrafts, setShipmentDrafts] = useState<Record<number, ShipmentDraft>>({});
  const [canManageStock, setCanManageStock] = useState(false);

  async function load() {
    const res = await fetch("/api/staff/tasks", { cache: "no-store" });
    const data = await res.json();
    if (res.status === 401) { router.push("/login"); return; }
    if (!res.ok) setError(data.error || "Нет доступа");
    else {
      setError("");
      const nextTasks = (data.tasks || []) as Task[];
      setTasks(nextTasks);
      setShipmentDrafts(current => {
        const next = { ...current };
        for (const task of nextTasks) {
          if (task.stage === "shipping" && !next[task.id]) {
            next[task.id] = {
              quantities: Object.fromEntries(task.items.map(item => [item.id, maxShippable(item)])),
              carrier: "", trackingNumber: "", note: "",
            };
          }
        }
        return next;
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    fetch("/api/me", { cache: "no-store" }).then(res => res.json()).then(data => {
      setCanManageStock(["admin", "warehouse"].includes(data.user?.role));
    }).catch(() => setCanManageStock(false));
  }, []);

  async function updateTask(id: number, status: "in_progress" | "completed") {
    setBusy(id); setError(""); setSuccess("");
    const res = await fetch(`/api/staff/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    const data = await res.json(); setBusy(null);
    if (!res.ok) setError(data.error || "Не удалось обновить задание");
    else { setSuccess(status === "completed" ? "Этап завершён." : "Задание принято в работу."); await load(); }
  }

  function updateDraft(taskId: number, patch: Partial<ShipmentDraft>) {
    setShipmentDrafts(current => ({
      ...current,
      [taskId]: {
        quantities: current[taskId]?.quantities || {},
        carrier: current[taskId]?.carrier || "",
        trackingNumber: current[taskId]?.trackingNumber || "",
        note: current[taskId]?.note || "",
        ...patch,
      },
    }));
  }

  function updateQuantity(taskId: number, itemId: number, value: number) {
    const draft = shipmentDrafts[taskId];
    updateDraft(taskId, { quantities: { ...(draft?.quantities || {}), [itemId]: value } });
  }

  async function createShipment(task: Task) {
    const draft = shipmentDrafts[task.id];
    const selected = task.items
      .map(item => ({ orderItemId: item.id, quantity: Number(draft?.quantities[item.id] || 0) }))
      .filter(item => item.quantity > 0);
    if (!selected.length) { setError("Укажите количество хотя бы по одной позиции для отправления."); return; }
    setBusy(task.id); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/orders/${task.order_id}/fulfillments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected,
          carrier: draft?.carrier || "",
          trackingNumber: draft?.trackingNumber || "",
          note: draft?.note || "",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Не удалось оформить отправление");
      } else {
        setSuccess(data.allShipped
          ? `Отправление №${data.fulfillmentId} оформлено. Весь заказ передан в доставку.`
          : `Отправление №${data.fulfillmentId} оформлено. Остаток заказа сохранён для следующей отправки.`);
        setShipmentDrafts(current => { const next = { ...current }; delete next[task.id]; return next; });
        await load();
      }
    } catch {
      setError("Не удалось связаться с сервером при оформлении отправления.");
    } finally {
      setBusy(null);
    }
  }

  return <main style={{ maxWidth: 1100, margin: "0 auto", padding: "42px 22px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div><span className="eyebrow">РАБОЧЕЕ МЕСТО</span><h1 style={{ margin: "8px 0 24px" }}>Мои задания</h1></div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}><Link href="/staff" className="text-link">Рабочая панель</Link>{canManageStock && <Link href="/staff/warehouse" className="text-link">Склад →</Link>}<Link href="/" className="text-link">На сайт</Link></div>
    </div>
    {error && <p role="alert" style={{ color: "#a33", padding: 12, background: "#fff0ef" }}>{error}</p>}
    {success && <p role="status" style={{ color: "#236b42", padding: 12, background: "#edf8f0" }}>{success}</p>}
    {loading ? <p>Загрузка заданий...</p> : tasks.length === 0 ? <section style={{ padding: 28, background: "#fff", border: "1px solid #e8e1d8" }}>Назначенных заданий пока нет.</section> :
      <div style={{ display: "grid", gap: 14 }}>
        {tasks.map(task => {
          const draft = shipmentDrafts[task.id];
          return <article key={task.id} style={{ padding: 22, background: "#fff", border: "1px solid #e8e1d8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <strong>Заказ №{String(task.order_id).padStart(5, "0")}</strong>
              <span>{task.task_status === "pending" ? "Ожидает принятия" : task.task_status === "in_progress" ? "В работе" : "Завершено"}</span>
            </div>
            <h2 style={{ margin: "12px 0" }}>{STAGES[task.stage] || task.stage}</h2>
            <p style={{ margin: "6px 0" }}>Клиент: {task.customer_company || task.customer_email}</p>
            <p style={{ margin: "6px 0" }}>Контакт: {task.contact_name || "—"} · {task.contact_phone ? <a href={`tel:${task.contact_phone}`}>{task.contact_phone}</a> : "—"}</p>
            <p style={{ margin: "6px 0" }}>Email заказчика: <a href={`mailto:${task.customer_email}`}>{task.customer_email}</a></p>
            <p style={{ margin: "6px 0" }}>Сумма заказа: {money(task.total)} BYN</p>
            {task.note && <p style={{ color: "#6d665e" }}>Примечание: {task.note}</p>}
            {task.stage !== "shipping" && task.items.length > 0 && <section style={{ marginTop: 16, padding: 14, background: "#f8f7f4", border: "1px solid #e8e1d8" }}>
              <h3 style={{ margin: "0 0 10px" }}>Состав заказа</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {task.items.map(item => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", paddingBottom: 8, borderBottom: "1px solid #e8e1d8" }}>
                  <div><strong>{item.product_name}</strong><small style={{ display: "block", color: "#746d65" }}>Артикул: {item.sku || "—"}{item.available_quantity != null ? ` · Подтверждено: ${item.available_quantity} шт.` : ""}</small></div>
                  <strong>{item.quantity} шт.</strong>
                </div>)}
              </div>
            </section>}

            {task.stage === "shipping" && task.task_status === "in_progress" && <section style={{ marginTop: 18, padding: 16, background: "#f8f7f4", border: "1px solid #e8e1d8" }}>
              <h3 style={{ margin: "0 0 8px" }}>Оформление отправления</h3>
              <p style={{ margin: "0 0 14px", color: "#6d665e", fontSize: 13 }}>Можно отправить доступную часть заказа. Неотправленные количества останутся в заказе, и для них можно будет создать следующее отправление.</p>
              <div style={{ display: "grid", gap: 10 }}>
                {task.items.map(item => {
                  const max = maxShippable(item);
                  return <div key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) 120px", gap: 12, alignItems: "center", padding: 10, background: "#fff" }}>
                    <div>
                      <strong>{item.product_name}</strong>
                      <small style={{ display: "block", color: "#777" }}>Заказано: {item.quantity} · Отправлено: {item.shipped_quantity} · Остаток склада: {item.stock_quantity} · Доступно к отправке: {max}</small>
                    </div>
                    <label style={{ fontSize: 13 }}>Отправить сейчас
                      <input type="number" min="0" max={max} value={draft?.quantities[item.id] ?? 0} onChange={e => updateQuantity(task.id, item.id, Math.max(0, Math.min(max, Number(e.target.value))))} style={{ display: "block", width: "100%", padding: 9, marginTop: 4, border: "1px solid #d8d0c6" }} />
                    </label>
                  </div>;
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
                <label style={{ fontSize: 13 }}>Перевозчик / служба доставки
                  <input value={draft?.carrier || ""} onChange={e => updateDraft(task.id, { carrier: e.target.value })} placeholder="Например, собственная доставка" style={{ display: "block", width: "100%", padding: 9, marginTop: 4, border: "1px solid #d8d0c6" }} />
                </label>
                <label style={{ fontSize: 13 }}>Номер отправления
                  <input value={draft?.trackingNumber || ""} onChange={e => updateDraft(task.id, { trackingNumber: e.target.value })} placeholder="Номер накладной" style={{ display: "block", width: "100%", padding: 9, marginTop: 4, border: "1px solid #d8d0c6" }} />
                </label>
                <label style={{ fontSize: 13 }}>Комментарий
                  <input value={draft?.note || ""} onChange={e => updateDraft(task.id, { note: e.target.value })} placeholder="Примечание к отправлению" style={{ display: "block", width: "100%", padding: 9, marginTop: 4, border: "1px solid #d8d0c6" }} />
                </label>
              </div>
              <button className="button dark" disabled={busy === task.id || task.items.every(item => maxShippable(item) === 0)} onClick={() => createShipment(task)} style={{ marginTop: 14 }}>
                {busy === task.id ? "Оформление..." : "Оформить отправление"}
              </button>
            </section>}

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              {task.task_status === "pending" && <button className="button dark" disabled={busy === task.id} onClick={() => updateTask(task.id, "in_progress")}>Принять в работу</button>}
              {task.stage !== "shipping" && task.task_status === "in_progress" && <button className="button dark" disabled={busy === task.id} onClick={() => updateTask(task.id, "completed")}>Завершить этап</button>}
              {task.stage === "shipping" && task.task_status === "in_progress" && <span style={{ color: "#6d665e", alignSelf: "center" }}>Этап завершится автоматически после отправки всех позиций заказа.</span>}
              {task.task_status === "completed" && <span>Этап завершён</span>}
            </div>
          </article>;
        })}
      </div>}
  </main>;
}
