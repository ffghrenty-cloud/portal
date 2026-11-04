"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type Staff = { id: number; email: string; role: string };
type Task = { id: number; stage: string; status: string; note: string | null; assigned_email: string | null; assigned_by_email: string | null; created_at: string };
const STAGES = [
  { value: "manager_review", label: "Проверка менеджером", role: "manager" },
  { value: "warehouse", label: "Приёмка на складе", role: "warehouse" },
  { value: "picking", label: "Комплектация", role: "warehouse" },
  { value: "quality_check", label: "Контроль качества", role: "quality" },
  { value: "packing", label: "Упаковка", role: "packer" },
  { value: "shipping", label: "Отгрузка и логистика", role: "logistics" },
];
const ROLE_NAMES: Record<string, string> = { manager: "Менеджер", warehouse: "Склад", quality: "Контроль качества", packer: "Упаковка", logistics: "Логистика" };
export default function OrderWorkflowPage() {
  const params = useParams(); const id = String(params.id);
  const [staff, setStaff] = useState<Staff[]>([]); const [tasks, setTasks] = useState<Task[]>([]);
  const [stage, setStage] = useState("manager_review"); const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const selectedStage = STAGES.find(item => item.value === stage)!;
  const eligible = staff.filter(person => person.role === selectedStage.role);
  async function load() {
    const [staffRes, taskRes] = await Promise.all([
      fetch("/api/admin/staff", { cache: "no-store" }), fetch(`/api/admin/orders/${id}/tasks`, { cache: "no-store" }),
    ]);
    const staffData = await staffRes.json(); const taskData = await taskRes.json();
    if (staffRes.ok) setStaff(staffData.staff || []);
    if (taskRes.ok) setTasks(taskData.tasks || []);
    if (!staffRes.ok || !taskRes.ok) setMessage(staffData.error || taskData.error || "Не удалось загрузить данные");
  }
  useEffect(() => { load(); }, [id]);
  useEffect(() => { setAssignee(eligible[0] ? String(eligible[0].id) : ""); }, [stage, staff.length]);
  async function assign(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    const res = await fetch(`/api/admin/orders/${id}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage, assignedUserId: Number(assignee), note }) });
    const data = await res.json(); setBusy(false);
    if (!res.ok) setMessage(data.error || "Не удалось назначить сотрудника");
    else { setMessage("Сотрудник назначен на этап"); setNote(""); load(); }
  }
  return <AdminGuard><AdminLayout>
    <div className="admin-header"><span className="eyebrow">ЗАКАЗ №{String(id).padStart(5, "0")}</span><h1 className="admin-title">Маршрут обработки</h1><Link href="/admin/orders" className="text-link">← К заказам</Link></div>
    <form onSubmit={assign} style={{ display: "grid", gap: 14, maxWidth: 680, padding: 24, background: "#fff", border: "1px solid #e8e1d8", marginBottom: 28 }}>
      <h2 style={{ margin: 0 }}>Назначить ответственного</h2>
      <label>Этап<select value={stage} onChange={e => setStage(e.target.value)} style={fieldStyle}>{STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      <label>Сотрудник<select required value={assignee} onChange={e => setAssignee(e.target.value)} style={fieldStyle}><option value="">Выберите сотрудника</option>{eligible.map(person => <option key={person.id} value={person.id}>{person.email}</option>)}</select></label>
      {eligible.length === 0 && <p style={{ color: "#9a5b28" }}>Нет сотрудников с ролью «{ROLE_NAMES[selectedStage.role]}». Сначала создайте сотрудника в разделе «Сотрудники».</p>}
      <label>Примечание<input value={note} onChange={e => setNote(e.target.value)} style={fieldStyle} /></label>
      <button className="button dark" type="submit" disabled={busy || !assignee}>{busy ? "Назначение..." : "Назначить этап"}</button>
      {message && <p role="status">{message}</p>}
    </form>
    <h2 style={{ marginBottom: 14 }}>Назначенные этапы</h2>
    <div style={{ display: "grid", gap: 10 }}>
      {tasks.map(task => <article key={task.id} style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}>
        <strong>{STAGES.find(s => s.value === task.stage)?.label || task.stage}</strong>
        <p style={{ margin: "7px 0" }}>Ответственный: {task.assigned_email || "Не назначен"}</p>
        <p style={{ margin: "7px 0" }}>Статус: {task.status === "pending" ? "Ожидает" : task.status === "in_progress" ? "В работе" : "Завершён"}</p>
        {task.note && <small>{task.note}</small>}
      </article>)}
      {tasks.length === 0 && <p>Для этого заказа ещё не назначены сотрудники.</p>}
    </div>
  </AdminLayout></AdminGuard>;
}
const fieldStyle: React.CSSProperties = { display: "block", width: "100%", marginTop: 6, padding: "10px 12px", border: "1px solid #d8d0c6", borderRadius: 4, background: "#fff" };
