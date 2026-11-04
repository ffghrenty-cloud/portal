"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Task = {
  id: number; order_id: number; stage: string; task_status: string; note: string | null;
  created_at: string; order_status: string; total: number; contact_name: string | null;
  contact_phone: string | null; customer_email: string; customer_company: string | null;
};
const STAGES: Record<string, string> = {
  manager_review: "Проверка менеджером", warehouse: "Приёмка на складе", picking: "Комплектация",
  quality_check: "Контроль качества", packing: "Упаковка", shipping: "Отгрузка и логистика",
};
export default function StaffTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  async function load() {
    const res = await fetch("/api/staff/tasks", { cache: "no-store" });
    const data = await res.json();
    if (res.status === 401) { router.push("/login"); return; }
    if (!res.ok) setError(data.error || "Нет доступа");
    else { setError(""); setTasks(data.tasks || []); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  async function updateTask(id: number, status: "in_progress" | "completed") {
    setBusy(id); setError("");
    const res = await fetch(`/api/staff/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    const data = await res.json(); setBusy(null);
    if (!res.ok) setError(data.error || "Не удалось обновить задание");
    else load();
  }
  return <main style={{ maxWidth: 1100, margin: "0 auto", padding: "42px 22px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div><span className="eyebrow">РАБОЧЕЕ МЕСТО</span><h1 style={{ margin: "8px 0 24px" }}>Мои задания</h1></div>
      <Link href="/" className="text-link">На сайт</Link>
    </div>
    {error && <p role="alert" style={{ color: "#a33" }}>{error}</p>}
    {loading ? <p>Загрузка заданий...</p> : tasks.length === 0 ? <section style={{ padding: 28, background: "#fff", border: "1px solid #e8e1d8" }}>Назначенных заданий пока нет.</section> :
      <div style={{ display: "grid", gap: 14 }}>
        {tasks.map(task => <article key={task.id} style={{ padding: 22, background: "#fff", border: "1px solid #e8e1d8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>Заказ №{String(task.order_id).padStart(5, "0")}</strong>
            <span>{task.task_status === "pending" ? "Ожидает выполнения" : task.task_status === "in_progress" ? "В работе" : "Завершено"}</span>
          </div>
          <h2 style={{ margin: "12px 0" }}>{STAGES[task.stage] || task.stage}</h2>
          <p style={{ margin: "6px 0" }}>Клиент: {task.customer_company || task.customer_email}</p>
          <p style={{ margin: "6px 0" }}>Контакт: {task.contact_name || "—"} · {task.contact_phone || "—"}</p>
          <p style={{ margin: "6px 0" }}>Сумма заказа: {Number(task.total).toFixed(2).replace(".", ",")} BYN</p>
          {task.note && <p style={{ color: "#6d665e" }}>Примечание: {task.note}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            {task.task_status === "pending" && <button className="button dark" disabled={busy === task.id} onClick={() => updateTask(task.id, "in_progress")}>Принять в работу</button>}
            {task.task_status !== "completed" && <button className="button dark" disabled={busy === task.id} onClick={() => updateTask(task.id, "completed")}>Завершить этап</button>}
            {task.task_status === "completed" && <span>Этап завершён</span>}
          </div>
        </article>)}
      </div>}
  </main>;
}
