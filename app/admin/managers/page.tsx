"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type Order = { id: number; status: string; total: number; contact_name: string | null; manager: string | null; created_at: string; user_email: string; user_company: string | null };
type Manager = { id: number; email: string; role: string };
const STATUS: Record<string, string> = { stock_checked: "Наличие проверено", confirmed: "Подтверждён", pending: "Ожидает проверки", production: "В производстве", ready: "Готов к отгрузке", warehouse: "На складе", picking: "Комплектуется", quality_check: "Контроль качества", packing: "Упаковка", partially_shipped: "Частично отгружен", shipped: "Отгружен", delivered: "Доставлен", cancelled: "Отменён", draft: "Черновик" };

export default function ManagerAssignmentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("needs");
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const [ordersResponse, staffResponse] = await Promise.all([
      fetch("/api/admin/orders", { cache: "no-store" }),
      fetch("/api/admin/staff", { cache: "no-store" })
    ]);
    const [ordersData, staffData] = await Promise.all([ordersResponse.json(), staffResponse.json()]);
    if (!ordersResponse.ok || !staffResponse.ok) { setMessage(ordersData.error || staffData.error || "Не удалось загрузить данные"); return; }
    const list = ordersData.orders || [];
    const team = (staffData.staff || []).filter((person: Manager) => ["manager", "senior_manager"].includes(person.role));
    setOrders(list); setManagers(team);
    setAssignments(current => Object.fromEntries(list.map((order: Order) => [order.id, current[order.id] || String(team.find((m: Manager) => m.email === order.manager)?.id || team[0]?.id || "")])));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => orders.filter(order => {
    const query = `${order.id} ${order.user_email} ${order.user_company || ""} ${order.contact_name || ""} ${order.manager || ""}`.toLowerCase();
    const statusMatch = filter === "all" || (filter === "needs" ? ["stock_checked", "confirmed"].includes(order.status) : order.manager === filter);
    return statusMatch && query.includes(search.toLowerCase());
  }), [orders, filter, search]);

  async function assign(orderId: number) {
    const managerId = Number(assignments[orderId]);
    if (!managerId) { setMessage("Сначала выберите менеджера"); return; }
    setBusy(orderId); setMessage("");
    const response = await fetch(`/api/admin/orders/${orderId}/tasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "manager_review", assignedUserId: managerId, note: "Назначено через распределение заказов менеджерам" })
    });
    const data = await response.json(); setBusy(null);
    if (!response.ok) { setMessage(data.error || "Не удалось назначить менеджера"); return; }
    setMessage(`Менеджер назначен на заказ №${orderId}`);
    await load();
  }

  return <AdminGuard><AdminLayout>
    <div className="admin-header"><span className="eyebrow">УПРАВЛЕНИЕ КОМАНДОЙ</span><h1 className="admin-title">Распределение заказов менеджерам</h1><p>Назначайте ответственного менеджера и переназначайте заказы при необходимости.</p></div>
    {message && <p role="status">{message}</p>}
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по номеру заказа, клиенту, менеджеру..." style={{ padding: 10, minWidth: 260, border: "1px solid #d8d0c6" }} />
      <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: 10, border: "1px solid #d8d0c6" }}>
        <option value="needs">Ожидают менеджера</option><option value="all">Все заказы</option>
        {managers.map(manager => <option key={manager.id} value={manager.email}>{manager.email}</option>)}
      </select>
      <span style={{ alignSelf: "center" }}>Заказов: {filtered.length}</span>
    </div>
    <div className="admin-table">
      <div className="admin-table-head"><div>Заказ</div><div>Клиент</div><div>Статус</div><div>Менеджер</div><div>Назначение</div></div>
      {filtered.map(order => <div className="admin-table-row" key={order.id}>
        <div><Link href={`/admin/orders/${order.id}/workflow`}>№{String(order.id).padStart(5, "0")}</Link><small style={{ display: "block" }}>{new Date(order.created_at).toLocaleDateString("ru-RU")}</small></div>
        <div>{order.user_company || order.user_email}<small style={{ display: "block" }}>{order.contact_name || ""}</small></div>
        <div>{STATUS[order.status] || order.status}</div>
        <div>{order.manager || "Не назначен"}</div>
        <div style={{ display: "flex", gap: 6, minWidth: 220 }}>
          <select aria-label={`Менеджер для заказа ${order.id}`} value={assignments[order.id] || ""} onChange={e => setAssignments(current => ({ ...current, [order.id]: e.target.value }))} style={{ minWidth: 130, padding: 6 }}>
            <option value="">Выберите</option>{managers.map(manager => <option key={manager.id} value={manager.id}>{manager.email}</option>)}
          </select>
          <button className="button dark" disabled={busy === order.id || !managers.length} onClick={() => assign(order.id)}>{busy === order.id ? "..." : order.manager ? "Переназначить" : "Назначить"}</button>
        </div>
      </div>)}
      {!filtered.length && <p style={{ padding: 18 }}>Заказы не найдены.</p>}
    </div>
  </AdminLayout></AdminGuard>;
}
