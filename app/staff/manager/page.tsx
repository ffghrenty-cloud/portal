"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Item = {
  id: number;
  product_name: string;
  quantity: number;
  price: number;
  available_quantity: number | null;
  stock_quantity: number;
};
type Task = {
  task_id: number;
  order_id: number;
  task_status: "pending" | "in_progress" | "completed";
  task_note: string | null;
  assigned_at: string;
  order_status: string;
  total: number;
  subtotal: number;
  discount_percent: number;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  comment: string | null;
  order_created_at: string;
  customer_email: string;
  customer_company: string | null;
  items: Item[];
};
type Manager = { email: string; role: string };
const money = (value: number) => `${Number(value || 0).toFixed(2).replace(".", ",")} BYN`;
const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e8e1d8", padding: 22, borderRadius: 8 };
const button: React.CSSProperties = { border: 0, padding: "10px 16px", borderRadius: 5, cursor: "pointer", background: "#252525", color: "#fff", fontWeight: 600 };

export default function ManagerWorkspacePage() {
  const router = useRouter();
  const [manager, setManager] = useState<Manager | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/manager", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) { setError(data.error || "Не удалось открыть панель"); setLoading(false); return; }
      setManager(data.manager);
      setTasks(data.tasks || []);
      setError("");
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function updateTask(taskId: number, status: "in_progress" | "completed") {
    setBusy(taskId);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/staff/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: status === "completed" ? "Заказ проверен менеджером" : undefined }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Не удалось обновить заказ");
      else {
        setSuccess(status === "completed" ? "Заказ согласован и передан на следующий этап." : "Заказ принят вами в работу.");
        await load();
      }
    } catch {
      setError("Ошибка соединения при обновлении заказа");
    } finally {
      setBusy(null);
    }
  }

  const pending = tasks.filter(task => task.task_status === "pending").length;
  const inProgress = tasks.filter(task => task.task_status === "in_progress").length;
  const completed = tasks.filter(task => task.task_status === "completed").length;

  return <main style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 22px 60px" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div>
        <span className="eyebrow">РАБОЧЕЕ МЕСТО</span>
        <h1 style={{ margin: "8px 0 5px", fontSize: 32 }}>Панель менеджера</h1>
        <p style={{ margin: 0, color: "#746d65" }}>{manager?.email || "Загрузка профиля"} · проверка заказов после склада</p>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Link href="/staff/tasks" className="text-link">Все мои задания</Link>
        <Link href="/" className="text-link">На сайт</Link>
      </div>
    </header>

    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 22 }}>
      <div style={panel}><strong style={{ fontSize: 30 }}>{pending}</strong><div style={{ color: "#746d65" }}>Новые заказы</div></div>
      <div style={panel}><strong style={{ fontSize: 30 }}>{inProgress}</strong><div style={{ color: "#746d65" }}>В работе</div></div>
      <div style={panel}><strong style={{ fontSize: 30 }}>{completed}</strong><div style={{ color: "#746d65" }}>Согласованы</div></div>
    </section>

    {error && <p role="alert" style={{ color: "#a12b2b", background: "#fff0ef", padding: 12 }}>{error}</p>}
    {success && <p role="status" style={{ color: "#236b42", background: "#edf8f0", padding: 12 }}>{success}</p>}
    {loading ? <p>Загрузка очереди...</p> : tasks.length === 0 ? (
      <section style={panel}><h2 style={{ marginTop: 0 }}>Новых назначенных заказов нет</h2><p style={{ color: "#746d65" }}>Когда приёмщик подтвердит наличие товаров, заказ появится здесь автоматически.</p></section>
    ) : <div style={{ display: "grid", gap: 16 }}>
      {tasks.map(task => <article key={task.task_id} style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div>
            <span style={{ color: "#8a7156", fontSize: 12, fontWeight: 700 }}>ЗАКАЗ №{String(task.order_id).padStart(5, "0")}</span>
            <h2 style={{ margin: "5px 0" }}>{task.customer_company || task.customer_email}</h2>
            <small style={{ color: "#746d65" }}>Создан {new Date(task.order_created_at).toLocaleString("ru-RU")}</small>
          </div>
          <span style={{ padding: "7px 10px", background: task.task_status === "completed" ? "#edf8f0" : task.task_status === "in_progress" ? "#fff5df" : "#f2eee8", borderRadius: 20, fontSize: 13 }}>
            {task.task_status === "completed" ? "Согласован" : task.task_status === "in_progress" ? "В работе" : "Ожидает проверки"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, margin: "18px 0" }}>
          <div><small style={{ color: "#746d65" }}>Контактное лицо</small><div>{task.contact_name || "Не указано"}</div></div>
          <div><small style={{ color: "#746d65" }}>Телефон</small><div>{task.contact_phone ? <a href={`tel:${task.contact_phone}`}>{task.contact_phone}</a> : "Не указан"}</div></div>
          <div><small style={{ color: "#746d65" }}>Email</small><div><a href={`mailto:${task.customer_email}`}>{task.customer_email}</a></div></div>
          <div><small style={{ color: "#746d65" }}>Адрес</small><div>{task.address || "Не указан"}</div></div>
        </div>

        <h3 style={{ margin: "12px 0" }}>Состав заказа и наличие</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead><tr style={{ textAlign: "left", color: "#746d65", fontSize: 13 }}>
              <th style={{ padding: "9px 8px", borderBottom: "1px solid #e8e1d8" }}>Товар</th>
              <th style={{ padding: "9px 8px", borderBottom: "1px solid #e8e1d8" }}>Заказано</th>
              <th style={{ padding: "9px 8px", borderBottom: "1px solid #e8e1d8" }}>На складе</th>
              <th style={{ padding: "9px 8px", borderBottom: "1px solid #e8e1d8" }}>Проверка</th>
              <th style={{ padding: "9px 8px", borderBottom: "1px solid #e8e1d8" }}>Сумма</th>
            </tr></thead>
            <tbody>{task.items.map(item => {
              const available = Math.max(0, Math.min(item.stock_quantity, item.available_quantity ?? item.stock_quantity));
              const enough = available >= item.quantity;
              return <tr key={item.id}>
                <td style={{ padding: "11px 8px", borderBottom: "1px solid #eee" }}>{item.product_name}</td>
                <td style={{ padding: "11px 8px", borderBottom: "1px solid #eee" }}>{item.quantity} шт.</td>
                <td style={{ padding: "11px 8px", borderBottom: "1px solid #eee" }}>{item.stock_quantity} шт.</td>
                <td style={{ padding: "11px 8px", borderBottom: "1px solid #eee", color: enough ? "#237346" : "#a12b2b", fontWeight: 600 }}>{enough ? "Достаточно" : `Не хватает: ${item.quantity - available}`}</td>
                <td style={{ padding: "11px 8px", borderBottom: "1px solid #eee" }}>{money(item.price * item.quantity)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>

        {task.comment && <p style={{ marginBottom: 0, color: "#746d65" }}>Комментарий клиента: {task.comment}</p>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 18, paddingTop: 16, borderTop: "1px solid #e8e1d8" }}>
          <div><small style={{ color: "#746d65" }}>Итого к оплате</small><div style={{ fontSize: 22, fontWeight: 700 }}>{money(task.total)}</div>{Number(task.discount_percent) > 0 && <small>Персональная скидка: {task.discount_percent}%</small>}</div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            {task.task_status === "pending" && <button style={button} disabled={busy === task.task_id} onClick={() => updateTask(task.task_id, "in_progress")}>Принять заказ</button>}
            {task.task_status !== "completed" && <button style={button} disabled={busy === task.task_id} onClick={() => updateTask(task.task_id, "completed")}>Согласовать и передать дальше</button>}
            {task.task_status === "completed" && <span style={{ color: "#237346", alignSelf: "center" }}>Передан на следующий этап</span>}
          </div>
        </div>
      </article>)}
    </div>}
  </main>;
}
