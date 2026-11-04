"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type Staff = { id: number; email: string; role: string };
type Task = { id: number; stage: string; status: string; note: string | null; assigned_email: string | null; assigned_by_email: string | null; created_at: string };
type TrackingOrder = { tracking_carrier: string | null; tracking_number: string | null; estimated_delivery: string | null; status: string };
type OrderLine = { id: number; product_name: string; quantity: number; available_quantity: number | null; shipped_quantity: number };
type Fulfillment = { id: number; status: string; carrier: string | null; trackingNumber: string | null; note: string | null; createdAt: string; items: Array<{ name: string; quantity: number }> };
const STAGES = [
  { value: "stock_check", label: "Проверка наличия на складе", role: "order_receiver" },
  { value: "manager_review", label: "Проверка менеджером", role: "manager" },
  { value: "warehouse", label: "Приёмка на складе", role: "warehouse" },
  { value: "picking", label: "Комплектация", role: "warehouse" },
  { value: "quality_check", label: "Контроль качества", role: "quality" },
  { value: "packing", label: "Упаковка", role: "packer" },
  { value: "shipment_preparation", label: "Подготовка и загрузка отправки", role: "shipment_preparer" },
  { value: "shipping", label: "Отгрузка и логистика", role: "logistics" },
  { value: "delivery", label: "Доставка клиенту", role: "logistics" },
];
const ROLE_NAMES: Record<string, string> = { order_receiver: "Приёмщик заказов", shipment_preparer: "Подготовка отправки", manager: "Менеджер", warehouse: "Склад", quality: "Контроль качества", packer: "Упаковка", logistics: "Логистика" };
const fieldStyle: React.CSSProperties = { display: "block", width: "100%", marginTop: 6, padding: "10px 12px", border: "1px solid #d8d0c6", borderRadius: 4, background: "#fff" };

export default function OrderWorkflowPage() {
  const params = useParams();
  const id = String(params.id);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stage, setStage] = useState("manager_review");
  const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [items, setItems] = useState<OrderLine[]>([]);
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [shipQuantities, setShipQuantities] = useState<Record<number, number>>({});
  const [shipmentCarrier, setShipmentCarrier] = useState("");
  const [shipmentTracking, setShipmentTracking] = useState("");
  const [shipmentNote, setShipmentNote] = useState("");
  const [shippingBusy, setShippingBusy] = useState(false);

  const selectedStage = STAGES.find((item) => item.value === stage)!;
  const eligible = staff.filter((person) => selectedStage.value === "manager_review"
    ? ["manager", "senior_manager"].includes(person.role)
    : person.role === selectedStage.role);

  async function load() {
    const [staffRes, taskRes, orderRes, fulfillmentRes] = await Promise.all([
      fetch("/api/admin/staff", { cache: "no-store" }),
      fetch(`/api/admin/orders/${id}/tasks`, { cache: "no-store" }),
      fetch(`/api/admin/orders/${id}`, { cache: "no-store" }),
      fetch(`/api/admin/orders/${id}/fulfillments`, { cache: "no-store" }),
    ]);
    const [staffData, taskData, orderData, fulfillmentData] = await Promise.all([staffRes.json(), taskRes.json(), orderRes.json(), fulfillmentRes.json()]);
    if (staffRes.ok) setStaff(staffData.staff || []);
    if (taskRes.ok) setTasks(taskData.tasks || []);
    if (orderRes.ok) {
      const current = orderData.order as TrackingOrder;
      setOrder(current);
      setCarrier(current.tracking_carrier || "");
      setTrackingNumber(current.tracking_number || "");
      setEstimatedDelivery(current.estimated_delivery || "");
      setItems(orderData.items || []);
      setShipQuantities(Object.fromEntries((orderData.items || []).map((item: OrderLine) => [item.id, Math.max(0, Math.min(item.quantity - item.shipped_quantity, (item.available_quantity ?? 0) - item.shipped_quantity))])));
    }
    if (fulfillmentRes.ok) setFulfillments(fulfillmentData.fulfillments || []);
    if (!staffRes.ok || !taskRes.ok || !orderRes.ok || !fulfillmentRes.ok) setMessage(staffData.error || taskData.error || orderData.error || "Не удалось загрузить данные");
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => { setAssignee(eligible[0] ? String(eligible[0].id) : ""); }, [stage, staff.length]);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/admin/orders/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, assignedUserId: Number(assignee), note }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) setMessage(data.error || "Не удалось назначить сотрудника");
    else { setMessage("Сотрудник назначен"); setNote(""); await load(); }
  }

  async function saveTracking(e: React.FormEvent) {
    e.preventDefault();
    setSavingTracking(true);
    setMessage("");
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingCarrier: carrier, trackingNumber, estimatedDelivery }),
    });
    const data = await res.json();
    setSavingTracking(false);
    if (!res.ok) setMessage(data.error || "Не удалось сохранить доставку");
    else { setMessage("Данные отслеживания сохранены"); await load(); }
  }

  async function createShipment(e: React.FormEvent) {
    e.preventDefault(); setShippingBusy(true); setMessage("");
    const selected = items.map(item => ({ orderItemId: item.id, quantity: Number(shipQuantities[item.id] || 0) })).filter(item => item.quantity > 0);
    if (!selected.length) { setMessage("Укажите количество хотя бы по одной позиции"); setShippingBusy(false); return; }
    const response = await fetch(`/api/admin/orders/${id}/fulfillments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: selected, carrier: shipmentCarrier, trackingNumber: shipmentTracking, note: shipmentNote })
    });
    const data = await response.json(); setShippingBusy(false);
    if (!response.ok) setMessage(data.error || "Не удалось оформить отправление");
    else { setMessage(`Отправление №${data.fulfillmentId} оформлено. Статус заказа: ${data.status === "shipped" ? "отгружен полностью" : "отгружена часть заказа"}.`); setShipmentTracking(""); setShipmentNote(""); await load(); }
  }

  return <AdminGuard><AdminLayout>
    <div className="admin-header">
      <span className="eyebrow">ЗАКАЗ №{String(id).padStart(5, "0")}</span>
      <h1 className="admin-title">Маршрут и отслеживание</h1>
      <Link href="/admin/orders" className="text-link">← К заказам</Link>
    </div>

    <form onSubmit={saveTracking} style={{ display: "grid", gap: 14, maxWidth: 680, padding: 24, background: "#fff", border: "1px solid #e8e1d8", marginBottom: 28 }}>
      <h2 style={{ margin: 0 }}>Данные отправления</h2>
      <label>Служба доставки / перевозчик<input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Например, собственная доставка" style={fieldStyle} /></label>
      <label>Номер отправления<input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Номер накладной или отправления" style={fieldStyle} /></label>
      <label>Ожидаемая дата доставки<input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} style={fieldStyle} /></label>
      <button className="button dark" type="submit" disabled={savingTracking}>{savingTracking ? "Сохранение..." : "Сохранить данные доставки"}</button>
      <small style={{ color: "#716b64" }}>Эти сведения появятся в личном кабинете клиента. Фактические перемещения перевозчика появятся после подключения API или вебхука службы доставки.</small>
    </form>

    <form onSubmit={createShipment} style={{ display: "grid", gap: 14, maxWidth: 850, padding: 24, background: "#fff", border: "1px solid #e8e1d8", marginBottom: 28 }}>
      <h2 style={{ margin: 0 }}>Частичная отгрузка</h2>
      <p style={{ margin: 0, color: "#716b64" }}>Укажите только то количество, которое отправляется сейчас. Остаток заказа останется открытым для следующего отправления.</p>
      {items.map(item => {
        const remaining = Math.max(0, item.quantity - item.shipped_quantity);
        const available = Math.max(0, Math.min(remaining, (item.available_quantity ?? 0) - item.shipped_quantity));
        return <div key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 110px 120px", gap: 12, alignItems: "center", padding: 10, background: "#f7f5f1" }}>
          <div><strong>{item.product_name}</strong><small style={{ display: "block", color: "#716b64" }}>Заказано: {item.quantity} · Уже отправлено: {item.shipped_quantity} · Подтверждено складом: {available}</small></div>
          <label>Отправить<input type="number" min="0" max={available} value={shipQuantities[item.id] ?? 0} onChange={e => setShipQuantities(current => ({ ...current, [item.id]: Math.max(0, Number(e.target.value)) }))} style={fieldStyle} /></label>
          <span>Осталось: {remaining}</span>
        </div>;
      })}
      <label>Перевозчик<input value={shipmentCarrier} onChange={e => setShipmentCarrier(e.target.value)} style={fieldStyle} placeholder="Служба доставки" /></label>
      <label>Номер отправления<input value={shipmentTracking} onChange={e => setShipmentTracking(e.target.value)} style={fieldStyle} /></label>
      <label>Примечание<input value={shipmentNote} onChange={e => setShipmentNote(e.target.value)} style={fieldStyle} placeholder="Например, первая партия" /></label>
      <button className="button dark" type="submit" disabled={shippingBusy}>{shippingBusy ? "Оформление..." : "Оформить отправление"}</button>
    </form>

    <section style={{ maxWidth: 850, padding: 24, background: "#fff", border: "1px solid #e8e1d8", marginBottom: 28 }}>
      <h2 style={{ marginTop: 0 }}>История отправлений</h2>
      {fulfillments.map(shipment => <div key={shipment.id} style={{ borderTop: "1px solid #eee", padding: "14px 0" }}>
        <strong>Отправление №{shipment.id}</strong> · {new Date(shipment.createdAt).toLocaleString("ru-RU")}
        <p>{shipment.carrier || "Перевозчик не указан"} · {shipment.trackingNumber || "Без номера"}</p>
        {shipment.items.map((item, index) => <div key={index}>{item.name}: {item.quantity} шт.</div>)}
        {shipment.note && <small>{shipment.note}</small>}
      </div>)}
      {fulfillments.length === 0 && <p>Отправлений пока нет.</p>}
    </section>

    <form onSubmit={assign} style={{ display: "grid", gap: 14, maxWidth: 680, padding: 24, background: "#fff", border: "1px solid #e8e1d8", marginBottom: 28 }}>
      <h2 style={{ margin: 0 }}>Ручное назначение / переназначение</h2>
      <label>Этап<select value={stage} onChange={(e) => setStage(e.target.value)} style={fieldStyle}>{STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      <label>Сотрудник<select required value={assignee} onChange={(e) => setAssignee(e.target.value)} style={fieldStyle}><option value="">Выберите сотрудника</option>{eligible.map((person) => <option key={person.id} value={person.id}>{person.email}</option>)}</select></label>
      {eligible.length === 0 && <p style={{ color: "#9a5b28" }}>Нет сотрудников с ролью «{ROLE_NAMES[selectedStage.role]}». Создайте сотрудника в разделе «Сотрудники».</p>}
      <label>Примечание<input value={note} onChange={(e) => setNote(e.target.value)} style={fieldStyle} /></label>
      <button className="button dark" type="submit" disabled={busy || !assignee}>{busy ? "Назначение..." : "Назначить этап"}</button>
    </form>

    {message && <p role="status">{message}</p>}
    <h2 style={{ marginBottom: 14 }}>История назначений</h2>
    <div style={{ display: "grid", gap: 10 }}>
      {tasks.map((task) => <article key={task.id} style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}>
        <strong>{STAGES.find((s) => s.value === task.stage)?.label || task.stage}</strong>
        <p style={{ margin: "7px 0" }}>Ответственный: {task.assigned_email || "Не назначен"}</p>
        <p style={{ margin: "7px 0" }}>Статус: {task.status === "pending" ? "Ожидает" : task.status === "in_progress" ? "В работе" : "Завершён"}</p>
        {task.note && <small>{task.note}</small>}
      </article>)}
      {tasks.length === 0 && <p>Задания ещё не назначены. Первый этап назначается автоматически после оформления заказа, если создан сотрудник-менеджер.</p>}
    </div>
  </AdminLayout></AdminGuard>;
}
