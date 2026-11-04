"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type Staff = { id: number; email: string; role: string };
type Task = { id: number; stage: string; status: string; note: string | null; assigned_email: string | null; assigned_by_email: string | null; created_at: string };
type TrackingOrder = { tracking_carrier: string | null; tracking_number: string | null; estimated_delivery: string | null };
const STAGES = [
  { value: "manager_review", label: "Проверка менеджером", role: "manager" },
  { value: "warehouse", label: "Приёмка на складе", role: "warehouse" },
  { value: "picking", label: "Комплектация", role: "warehouse" },
  { value: "quality_check", label: "Контроль качества", role: "quality" },
  { value: "packing", label: "Упаковка", role: "packer" },
  { value: "shipping", label: "Отгрузка и логистика", role: "logistics" },
  { value: "delivery", label: "Доставка клиенту", role: "logistics" },
];
const ROLE_NAMES: Record<string, string> = { manager: "Менеджер", warehouse: "Склад", quality: "Контроль качества", packer: "Упаковка", logistics: "Логистика" };
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

  const selectedStage = STAGES.find((item) => item.value === stage)!;
  const eligible = staff.filter((person) => selectedStage.value === "manager_review"
    ? ["manager", "senior_manager"].includes(person.role)
    : person.role === selectedStage.role);

  async function load() {
    const [staffRes, taskRes, orderRes] = await Promise.all([
      fetch("/api/admin/staff", { cache: "no-store" }),
      fetch(`/api/admin/orders/${id}/tasks`, { cache: "no-store" }),
      fetch(`/api/admin/orders/${id}`, { cache: "no-store" }),
    ]);
    const [staffData, taskData, orderData] = await Promise.all([staffRes.json(), taskRes.json(), orderRes.json()]);
    if (staffRes.ok) setStaff(staffData.staff || []);
    if (taskRes.ok) setTasks(taskData.tasks || []);
    if (orderRes.ok) {
      const current = orderData.order as TrackingOrder;
      setOrder(current);
      setCarrier(current.tracking_carrier || "");
      setTrackingNumber(current.tracking_number || "");
      setEstimatedDelivery(current.estimated_delivery || "");
    }
    if (!staffRes.ok || !taskRes.ok || !orderRes.ok) setMessage(staffData.error || taskData.error || orderData.error || "Не удалось загрузить данные");
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
