"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type Order = {
  id: number;
  status: string;
  total: number;
  contact_name: string | null;
  manager: string | null;
  created_at: string;
  user_email: string;
  user_company: string | null;
};
type Manager = { id: number; email: string; role: "manager" | "senior_manager" };
type Filter = "needs" | "assigned" | "all";

const STATUS: Record<string, string> = {
  stock_checked: "Наличие проверено",
  confirmed: "Подтверждён",
  pending: "Ожидает проверки наличия",
  production: "В производстве",
  ready: "Готов к отгрузке",
  warehouse: "На складе",
  picking: "Комплектуется",
  quality_check: "Контроль качества",
  packing: "Упаковка",
  partially_shipped: "Частично отгружен",
  shipped: "Отгружен",
  delivered: "Доставлен",
  cancelled: "Отменён",
  draft: "Черновик",
};

export default function ManagerAssignmentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("needs");
  const [busy, setBusy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [ordersResponse, staffResponse] = await Promise.all([
        fetch("/api/admin/orders", { cache: "no-store" }),
        fetch("/api/admin/staff", { cache: "no-store" }),
      ]);
      const [ordersData, staffData] = await Promise.all([
        ordersResponse.json(),
        staffResponse.json(),
      ]);
      if (!ordersResponse.ok || !staffResponse.ok) {
        setError(ordersData.error || staffData.error || "Не удалось загрузить данные");
        return;
      }

      const list: Order[] = ordersData.orders || [];
      const team: Manager[] = (staffData.staff || []).filter((person: Manager) =>
        ["manager", "senior_manager"].includes(person.role)
      );
      setOrders(list);
      setManagers(team);
      // Значение селектора всегда синхронизируется с фактическим ответственным из БД.
      setAssignments(Object.fromEntries(list.map((order) => [
        order.id,
        String(team.find((manager) => manager.email === order.manager)?.id || ""),
      ])));
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const unassignedCount = orders.filter((order) =>
    order.status === "stock_checked" && !order.manager
  ).length;
  const assignedCount = orders.filter((order) =>
    Boolean(order.manager) && !["cancelled", "delivered", "shipped"].includes(order.status)
  ).length;

  const filtered = useMemo(() => orders.filter((order) => {
    const query = `${order.id} ${order.user_email} ${order.user_company || ""} ${order.contact_name || ""} ${order.manager || ""}`.toLowerCase();
    const statusMatch = filter === "all"
      || (filter === "needs" && order.status === "stock_checked" && !order.manager)
      || (filter === "assigned" && Boolean(order.manager));
    return statusMatch && query.includes(search.trim().toLowerCase());
  }), [orders, filter, search]);

  async function assign(orderId: number) {
    const managerId = Number(assignments[orderId]);
    if (!managerId) {
      setError("Выберите менеджера перед назначением");
      return;
    }

    setBusy(orderId);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "manager_review",
          assignedUserId: managerId,
          note: "Назначено через распределение заказов менеджерам",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Не удалось назначить менеджера");
        return;
      }
      setMessage(data.reassigned
        ? `Ответственный по заказу №${orderId} изменён на ${data.assignedEmail}`
        : `Заказ №${orderId} назначен менеджеру ${data.assignedEmail}`);
      await load();
    } catch {
      setError("Не удалось связаться с сервером при назначении");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="admin-header">
          <span className="eyebrow">УПРАВЛЕНИЕ КОМАНДОЙ</span>
          <h1 className="admin-title">Распределение заказов менеджерам</h1>
          <p>Назначайте ответственного после проверки наличия и при необходимости передавайте заказ другому менеджеру.</p>
        </div>

        {error && <p role="alert" style={{ padding: 12, background: "#fff0ef", color: "#a12b2b" }}>{error}</p>}
        {message && <p role="status" style={{ padding: 12, background: "#edf8f0", color: "#236b42" }}>{message}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          <section style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}>
            <strong style={{ fontSize: 28 }}>{unassignedCount}</strong>
            <div>Ожидают назначения</div>
          </section>
          <section style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}>
            <strong style={{ fontSize: 28 }}>{assignedCount}</strong>
            <div>На менеджерах в работе</div>
          </section>
          <section style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}>
            <strong style={{ fontSize: 28 }}>{managers.length}</strong>
            <div>Менеджеров в команде</div>
          </section>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <input
            aria-label="Поиск заказов"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по номеру заказа, клиенту или менеджеру"
            style={{ padding: 10, minWidth: 260, border: "1px solid #d8d0c6", flex: "1 1 280px" }}
          />
          <select
            aria-label="Фильтр заказов"
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
            style={{ padding: 10, border: "1px solid #d8d0c6" }}
          >
            <option value="needs">Ожидают менеджера</option>
            <option value="assigned">Назначенные</option>
            <option value="all">Все заказы</option>
          </select>
          <button className="button dark" type="button" onClick={() => { setLoading(true); void load(); }}>
            Обновить
          </button>
        </div>

        {loading ? <p>Загрузка заказов...</p> : (
          <div className="admin-table">
            <div className="admin-table-head">
              <div>Заказ</div><div>Клиент</div><div>Статус</div><div>Менеджер</div><div>Назначение</div>
            </div>
            {filtered.map((order) => {
              const canAssign = order.status === "stock_checked";
              return (
                <div className="admin-table-row" key={order.id}>
                  <div>
                    <Link href={`/admin/orders/${order.id}/workflow`}>№{String(order.id).padStart(5, "0")}</Link>
                    <small style={{ display: "block" }}>{new Date(order.created_at).toLocaleDateString("ru-RU")}</small>
                  </div>
                  <div>
                    {order.user_company || order.user_email}
                    <small style={{ display: "block" }}>{order.contact_name || ""}</small>
                  </div>
                  <div>{STATUS[order.status] || order.status}</div>
                  <div>{order.manager || "Не назначен"}</div>
                  <div style={{ display: "flex", gap: 6, minWidth: 230, alignItems: "center" }}>
                    <select
                      aria-label={`Менеджер для заказа ${order.id}`}
                      value={assignments[order.id] || ""}
                      onChange={(event) => setAssignments((current) => ({ ...current, [order.id]: event.target.value }))}
                      style={{ minWidth: 130, padding: 6 }}
                      disabled={!canAssign || managers.length === 0}
                    >
                      <option value="">Выберите</option>
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>{manager.email}</option>
                      ))}
                    </select>
                    <button
                      className="button dark"
                      disabled={!canAssign || busy === order.id || !assignments[order.id]}
                      title={!canAssign ? "Менеджер назначается после проверки наличия" : "Назначить или переназначить менеджера"}
                      onClick={() => void assign(order.id)}
                    >
                      {busy === order.id ? "..." : order.manager ? "Передать" : "Назначить"}
                    </button>
                  </div>
                </div>
              );
            })}
            {!filtered.length && <p style={{ padding: 18 }}>Заказы не найдены.</p>}
          </div>
        )}

        {managers.length === 0 && (
          <p style={{ marginTop: 18 }}>
            Менеджеры пока не созданы. Добавьте сотрудника с ролью «Менеджер» или «Старший менеджер» в разделе{" "}
            <Link href="/admin/staff">«Сотрудники»</Link>.
          </p>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
