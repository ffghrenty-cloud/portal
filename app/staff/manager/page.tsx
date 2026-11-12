"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Item = { id: number; product_name: string; quantity: number; price: number; available_quantity: number | null; stock_quantity: number };
type Task = {
  task_id: number; order_id: number; task_status: "pending" | "in_progress" | "completed";
  task_note: string | null; assigned_at: string; order_status: string; total: number;
  discount_percent: number; contact_name: string | null; contact_phone: string | null;
  address: string | null; comment: string | null; order_created_at: string;
  customer_email: string; customer_company: string | null; items: Item[];
};
type Manager = { id: number; email: string; role: string };\ntype TeamOrder = { id: number; status: string; total: number; manager: string | null; created_at: string; customer_email: string; customer_company: string | null; contact_name: string | null };
type Filter = "all" | "pending" | "in_progress" | "completed";
const money = (v: number) => `${Number(v || 0).toFixed(2).replace(".", ",")} BYN`;
const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e8e1d8", padding: 22, borderRadius: 8 };
const button: React.CSSProperties = { border: 0, padding: "10px 15px", borderRadius: 5, cursor: "pointer", background: "#252525", color: "#fff", fontWeight: 600 };
const field: React.CSSProperties = { width: "100%", padding: 10, border: "1px solid #d8d0c6", borderRadius: 5, boxSizing: "border-box" };

export default function ManagerWorkspacePage() {
  const router = useRouter();
  const [manager, setManager] = useState<Manager | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);\n  const [teamOrders, setTeamOrders] = useState<TeamOrder[]>([]);\n  const [managers, setManagers] = useState<Manager[]>([]);\n  const [teamAssignments, setTeamAssignments] = useState<Record<number, string>>({});\n  const [teamBusy, setTeamBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/staff/manager", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok) { setError(data.error || "Не удалось открыть панель"); return; }
      setManager(data.manager);
      setTasks(data.tasks || []);
      setNotes(current => {
        const next = { ...current };
        for (const task of data.tasks || []) if (next[task.task_id] === undefined) next[task.task_id] = task.task_note || "";
        return next;
      });
      setError("");
    } catch { setError("Не удалось связаться с сервером"); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function assignTeamOrder(orderId: number) {
    const assignedUserId = Number(teamAssignments[orderId]);
    if (!assignedUserId) {
      setError("Выберите менеджера для назначения заказа");
      return;
    }
    setTeamBusy(orderId);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "manager_review",
          assignedUserId,
          note: "Назначено старшим менеджером из панели команды",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Не удалось передать заказ менеджеру");
      } else {
        setSuccess(data.reassigned
          ? `Ответственный по заказу №${orderId} изменён: ${data.assignedEmail}`
          : `Заказ №${orderId} назначен: ${data.assignedEmail}`);
        await load();
      }
    } catch {
      setError("Не удалось связаться с сервером при распределении заказа");
    } finally {
      setTeamBusy(null);
    }
  }

  async function updateTask(taskId: number, status: "in_progress" | "completed") {
    setBusy(taskId); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/staff/tasks/${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: notes[taskId] || (status === "completed" ? "Заказ согласован менеджером" : "") }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Не удалось обновить заказ");
      else { setSuccess(status === "completed" ? "Заказ согласован и передан на склад." : "Заказ принят в работу, заметка сохранена."); await load(); }
    } catch { setError("Ошибка соединения при обновлении заказа"); }
    finally { setBusy(null); }
  }

  async function sendCustomerMessage(task: Task) {
    const message = (messages[task.order_id] || "").trim();
    if (!message) return;
    setBusy(task.task_id); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/staff/manager/message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: task.order_id, message }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Не удалось отправить сообщение");
      else { setMessages(current => ({ ...current, [task.order_id]: "" })); setSuccess(`Сообщение по заказу №${task.order_id} отправлено покупателю.`); }
    } catch { setError("Ошибка соединения при отправке сообщения"); }
    finally { setBusy(null); }
  }

  const counts = {
    pending: tasks.filter(t => t.task_status === "pending").length,
    in_progress: tasks.filter(t => t.task_status === "in_progress").length,
    completed: tasks.filter(t => t.task_status === "completed").length,
  };
  const visible = useMemo(() => tasks.filter(task => {
    const matchesFilter = filter === "all" || task.task_status === filter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [task.order_id, task.customer_email, task.customer_company, task.contact_name, task.contact_phone].some(v => String(v || "").toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  }), [tasks, filter, search]);

  return <main style={{ maxWidth: 1240, margin: "0 auto", padding: "36px 22px 60px", color: "#292722" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      <div><span className="eyebrow">РАБОЧЕЕ МЕСТО</span><h1 style={{ margin: "8px 0 5px", fontSize: 32 }}>Панель менеджера</h1><p style={{ margin: 0, color: "#746d65" }}>{manager?.email || "Загрузка профиля"} · согласование заказов и связь с покупателями</p></div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}><button style={{ ...button, background: "#71634f" }} onClick={() => { setLoading(true); void load(); }}>Обновить</button><Link href="/staff/tasks" className="text-link">Все задания</Link><Link href="/" className="text-link">На сайт</Link></div>
    </header>

    {manager?.role === "senior_manager" && (
      <section style={{ ...panel, marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: "0 0 5px" }}>Распределение заказов между менеджерами</h2>
            <p style={{ margin: 0, color: "#746d65" }}>Здесь отображаются заказы, по которым приёмщик подтвердил наличие товаров. Старший менеджер может назначить или сменить ответственного.</p>
          </div>
          <strong>{teamOrders.length} ожидают распределения / переназначения</strong>
        </div>
        {teamOrders.length === 0 ? (
          <p style={{ marginBottom: 0, color: "#746d65" }}>Заказов, ожидающих согласования менеджером, сейчас нет.</p>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {teamOrders.map(order => (
              <div key={order.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(180px, 1fr) minmax(230px, 1fr)", gap: 12, alignItems: "center", padding: 12, background: "#f8f6f2", border: "1px solid #eee8e0" }}>
                <div>
                  <Link href={`/admin/orders/${order.id}/workflow`} style={{ fontWeight: 700 }}>Заказ №{String(order.id).padStart(5, "0")}</Link>
                  <small style={{ display: "block", color: "#746d65" }}>{order.customer_company || order.customer_email}</small>
                  {order.contact_name && <small style={{ display: "block", color: "#746d65" }}>{order.contact_name}</small>}
                </div>
                <div>
                  <small style={{ display: "block", color: "#746d65" }}>Текущий ответственный</small>
                  <strong>{order.manager || "Не назначен"}</strong>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    aria-label={`Менеджер для заказа ${order.id}`}
                    style={field}
                    value={teamAssignments[order.id] || ""}
                    onChange={event => setTeamAssignments(current => ({ ...current, [order.id]: event.target.value }))}
                    disabled={managers.length === 0}
                  >
                    <option value="">Выберите менеджера</option>
                    {managers.map(person => <option key={person.id} value={person.id}>{person.email} {person.role === "senior_manager" ? "(старший)" : ""}</option>)}
                  </select>
                  <button
                    style={button}
                    disabled={teamBusy === order.id || !teamAssignments[order.id]}
                    onClick={() => void assignTeamOrder(order.id)}
                  >
                    {teamBusy === order.id ? "..." : order.manager ? "Передать" : "Назначить"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {managers.length === 0 && <p style={{ color: "#a16b2e" }}>В системе пока нет менеджеров. Создайте сотрудника с соответствующей ролью в админ-панели.</p>}
      </section>
    )}

    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 22 }}>
      <div style={panel}><strong style={{ fontSize: 30 }}>{counts.pending}</strong><div style={{ color: "#746d65" }}>Новые заказы</div></div>
      <div style={panel}><strong style={{ fontSize: 30 }}>{counts.in_progress}</strong><div style={{ color: "#746d65" }}>В работе</div></div>
      <div style={panel}><strong style={{ fontSize: 30 }}>{counts.completed}</strong><div style={{ color: "#746d65" }}>Согласованы</div></div>
      <div style={panel}><strong style={{ fontSize: 30 }}>{tasks.length}</strong><div style={{ color: "#746d65" }}>Всего назначено</div></div>
    </section>

    {error && <p role="alert" style={{ color: "#a12b2b", background: "#fff0ef", padding: 12 }}>{error}</p>}
    {success && <p role="status" style={{ color: "#236b42", background: "#edf8f0", padding: 12 }}>{success}</p>}

    <section style={{ ...panel, marginBottom: 18, display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(200px, 260px)", gap: 12 }}>
      <input aria-label="Поиск заказов" style={field} value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по номеру, компании, email или телефону" />
      <select aria-label="Фильтр по статусу" style={field} value={filter} onChange={e => setFilter(e.target.value as Filter)}>
        <option value="all">Все заказы</option><option value="pending">Новые</option><option value="in_progress">В работе</option><option value="completed">Согласованные</option>
      </select>
    </section>

    {loading ? <p>Загрузка очереди...</p> : visible.length === 0 ? (
      <section style={panel}><h2 style={{ marginTop: 0 }}>{tasks.length ? "По заданным условиям ничего не найдено" : "Назначенных заказов пока нет"}</h2><p style={{ color: "#746d65" }}>Новые заказы появятся после проверки наличия приёмщиком. Если очередь неожиданно пуста, проверьте назначение сотрудника в админ-панели.</p></section>
    ) : <div style={{ display: "grid", gap: 16 }}>
      {visible.map(task => {
        const availableCount = task.items.reduce((sum, item) => sum + Math.max(0, Math.min(item.quantity, item.available_quantity ?? item.stock_quantity)), 0);
        const requestedCount = task.items.reduce((sum, item) => sum + item.quantity, 0);
        const stockReady = task.items.every(item => item.available_quantity !== null) && task.items.some(item => Number(item.available_quantity) > 0);
        return <article key={task.task_id} style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div><span style={{ color: "#8a7156", fontSize: 12, fontWeight: 700 }}>ЗАКАЗ №{String(task.order_id).padStart(5, "0")}</span><h2 style={{ margin: "5px 0" }}>{task.customer_company || task.customer_email}</h2><small style={{ color: "#746d65" }}>Создан {new Date(task.order_created_at).toLocaleString("ru-RU")}</small></div>
            <span style={{ padding: "7px 10px", background: task.task_status === "completed" ? "#edf8f0" : task.task_status === "in_progress" ? "#fff5df" : "#f2eee8", borderRadius: 20, fontSize: 13 }}>{task.task_status === "completed" ? "Согласован" : task.task_status === "in_progress" ? "В работе" : "Ожидает проверки"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, margin: "18px 0" }}>
            <div><small style={{ color: "#746d65" }}>Контактное лицо</small><div>{task.contact_name || "Не указано"}</div></div>
            <div><small style={{ color: "#746d65" }}>Телефон</small><div>{task.contact_phone ? <a href={`tel:${task.contact_phone}`}>{task.contact_phone}</a> : "Не указан"}</div></div>
            <div><small style={{ color: "#746d65" }}>Email</small><div><a href={`mailto:${task.customer_email}`}>{task.customer_email}</a></div></div>
            <div><small style={{ color: "#746d65" }}>Адрес доставки</small><div>{task.address || "Не указан"}</div></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><h3 style={{ margin: "10px 0" }}>Состав заказа и наличие</h3><small style={{ color: stockReady ? "#237346" : "#a16b2e" }}>Подтверждено {availableCount} из {requestedCount} шт.</small></div>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580 }}><thead><tr style={{ textAlign: "left", color: "#746d65", fontSize: 13 }}>{["Товар","Заказано","Подтверждено","Свободно на складе","Сумма"].map(label => <th key={label} style={{ padding: "9px 8px", borderBottom: "1px solid #e8e1d8" }}>{label}</th>)}</tr></thead><tbody>
            {task.items.map(item => { const qty = item.available_quantity ?? 0; const enough = qty >= item.quantity; return <tr key={item.id}><td style={{ padding: "11px 8px", borderBottom: "1px solid #eee" }}>{item.product_name}</td><td style={{ padding: "11px 8px", borderBottom: "1px solid #eee" }}>{item.quantity} шт.</td><td style={{ padding: "11px 8px", borderBottom: "1px solid #eee", color: enough ? "#237346" : "#a12b2b", fontWeight: 600 }}>{item.available_quantity === null ? "Не проверено" : `${qty} шт.`}</td><td style={{ padding: "11px 8px", borderBottom: "1px solid #eee" }}>{item.stock_quantity} шт.</td><td style={{ padding: "11px 8px", borderBottom: "1px solid #eee" }}>{money(item.price * item.quantity)}</td></tr>; })}
          </tbody></table></div>
          {task.comment && <p style={{ color: "#746d65" }}>Комментарий покупателя: {task.comment}</p>}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #e8e1d8", display: "grid", gap: 12 }}>
            <label><strong>Внутренняя заметка по заказу</strong><textarea rows={2} maxLength={1000} value={notes[task.task_id] ?? task.task_note ?? ""} onChange={e => setNotes(current => ({ ...current, [task.task_id]: e.target.value }))} placeholder="Условия согласования, договорённости, что нужно уточнить..." style={{ ...field, display: "block", marginTop: 6, resize: "vertical" }} /></label>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              {task.task_status !== "completed" && <button style={button} disabled={busy === task.task_id} onClick={() => updateTask(task.task_id, "in_progress")}>Сохранить заметку / принять в работу</button>}
              {task.task_status !== "completed" && <button style={{ ...button, background: stockReady ? "#276342" : "#8a6b3d" }} disabled={busy === task.task_id || !stockReady} title={!stockReady ? "Нужно проверить все позиции и подтвердить хотя бы одно доступное количество" : "Зарезервировать доступное количество и передать заказ на склад"} onClick={() => updateTask(task.task_id, "completed")}>Согласовать и передать на склад</button>}
              {task.task_status === "completed" && <span style={{ color: "#237346", alignSelf: "center" }}>Заказ передан на следующий этап</span>}
            </div>
            <details><summary style={{ cursor: "pointer", fontWeight: 600 }}>Написать покупателю</summary><div style={{ display: "grid", gap: 8, marginTop: 10 }}><textarea rows={3} maxLength={3000} value={messages[task.order_id] || ""} onChange={e => setMessages(current => ({ ...current, [task.order_id]: e.target.value }))} placeholder="Сообщение появится в личном кабинете покупателя..." style={{ ...field, resize: "vertical" }} /><button type="button" style={{ ...button, justifySelf: "start" }} disabled={busy === task.task_id || !(messages[task.order_id] || "").trim()} onClick={() => sendCustomerMessage(task)}>Отправить сообщение покупателю</button></div></details>
            <div><small style={{ color: "#746d65" }}>Итого к оплате: </small><strong>{money(task.total)}</strong>{Number(task.discount_percent) > 0 && <small style={{ marginLeft: 10 }}>Скидка {task.discount_percent}%</small>}</div>
          </div>
        </article>;
      })}
    </div>}
  </main>;
}
