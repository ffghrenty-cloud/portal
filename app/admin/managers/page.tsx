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

type Staff = { id: number; email: string; role: string };

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
  const [staff, setStaff] = useState<Staff[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [ordersResponse, staffResponse] = await Promise.all([
        fetch("/api/admin/orders", { cache: "no-store" }),
        fetch("/api/admin/staff", { cache: "no-store" }),
      ]);
      const [ordersData, staffData] = await Promise.all([ordersResponse.json(), staffResponse.json()]);
      if (!ordersResponse.ok || !staffResponse.ok) {
        setError(ordersData.error || staffData.error || "Не удалось загрузить данные");
        return;
      }
      setOrders(ordersData.orders || []);
      setStaff((staffData.staff || []).filter((person: Staff) =>
        ["manager", "senior_manager"].includes(person.role)
      ));
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeOrders = orders.filter((order) => !["cancelled", "delivered", "shipped"].includes(order.status));
  const assignedCount = activeOrders.filter((order) => Boolean(order.manager)).length;
  const unassignedCount = activeOrders.filter((order) => order.status === "stock_checked" && !order.manager).length;

  const filtered = useMemo(() => orders.filter((order) => {
    const query = `${order.id} ${order.user_email} ${order.user_company || ""} ${order.contact_name || ""} ${order.manager || ""}`.toLowerCase();
    const isActive = !["cancelled", "delivered", "shipped"].includes(order.status);
    return (filter === "all" || isActive) && query.includes(search.trim().toLowerCase());
  }), [orders, filter, search]);

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="admin-header">
          <span className="eyebrow">АВТОМАТИЧЕСКОЕ РАСПРЕДЕЛЕНИЕ</span>
          <h1 className="admin-title">Назначение ответственных</h1>
          <p>Система сама назначает сотрудника нужной роли при переходе заказа на следующий этап. Для выбора используется сотрудник с наименьшим количеством активных заданий.</p>
        </div>

        {error && <p role="alert" style={{ padding: 12, background: "#fff0ef", color: "#a12b2b" }}>{error}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
          <section style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}>
            <strong style={{ fontSize: 28 }}>{assignedCount}</strong>
            <div>Активных заказов с менеджером</div>
          </section>
          <section style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}>
            <strong style={{ fontSize: 28 }}>{unassignedCount}</strong>
            <div>Ожидают назначения менеджера</div>
          </section>
          <section style={{ padding: 18, background: "#fff", border: "1px solid #e8e1d8" }}>
            <strong style={{ fontSize: 28 }}>{staff.length}</strong>
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
          <select aria-label="Фильтр заказов" value={filter} onChange={(event) => setFilter(event.target.value as "active" | "all")} style={{ padding: 10, border: "1px solid #d8d0c6" }}>
            <option value="active">Активные заказы</option>
            <option value="all">Все заказы</option>
          </select>
          <button className="button dark" type="button" onClick={() => { setLoading(true); void load(); }}>Обновить</button>
        </div>

        {loading ? <p>Загрузка заказов...</p> : (
          <div className="admin-table">
            <div className="admin-table-head">
              <div>Заказ</div><div>Клиент</div><div>Статус</div><div>Назначенный менеджер</div>
            </div>
            {filtered.map((order) => (
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
                <div>{order.manager || (order.status === "stock_checked" ? "Ожидает автоматического назначения" : "Назначается на соответствующем этапе")}</div>
              </div>
            ))}
            {!filtered.length && <p style={{ padding: 18 }}>Заказы не найдены.</p>}
          </div>
        )}

        {staff.length === 0 && (
          <p style={{ marginTop: 18 }}>
            Менеджеры пока не созданы. Добавьте сотрудника с ролью «Менеджер» или «Старший менеджер» в разделе{" "}
            <Link href="/admin/staff">«Сотрудники»</Link>. После добавления система сможет назначать им новые заказы автоматически.
          </p>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}
