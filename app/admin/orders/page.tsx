"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type Order = {
  id: number;
  status: string;
  total: number;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  manager: string | null;
  created_at: string;
  user_email: string;
  user_company: string | null;
};

const STATUSES = [
  { value: "draft", label: "Черновик" },
  { value: "pending", label: "На согласовании" },
  { value: "confirmed", label: "Подтверждён" },
  { value: "production", label: "В производстве" },
  { value: "ready", label: "Готов к отгрузке" },
  { value: "shipped", label: "Отгружен" },
  { value: "cancelled", label: "Отменён" },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  async function loadOrders() {
    const res = await fetch("/api/admin/orders", { cache: "no-store" });
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function changeStatus(id: number, status: string) {
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadOrders();
  }

  const filtered =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="admin-header">
          <span className="eyebrow">АДМИНИСТРИРОВАНИЕ</span>
          <h1 className="admin-title">Заказы клиентов</h1>
        </div>

        <div className="orders-filters">
          <button
            className={filter === "all" ? "filter active-filter" : "filter"}
            onClick={() => setFilter("all")}
          >
            Все ({orders.length})
          </button>
          {STATUSES.map((s) => (
            <button
              key={s.value}
              className={filter === s.value ? "filter active-filter" : "filter"}
              onClick={() => setFilter(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p>Загрузка...</p>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">Заказов нет</div>
        ) : (
          <div className="admin-orders">
            {filtered.map((order) => (
              <div className="admin-order" key={order.id}>
                <div className="admin-order-head">
                  <div>
                    <b>№{String(order.id).padStart(5, "0")}</b>
                    <span className="admin-order-date">
                      {new Date(order.created_at).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                  <div className="admin-order-total">
                    {order.total.toFixed(2).replace(".", ",")} BYN
                  </div>
                </div>

                <div className="admin-order-body">
                  <div>
                    <div className="admin-order-label">Клиент</div>
                    <div>{order.user_company || order.user_email}</div>
                  </div>
                  <div>
                    <div className="admin-order-label">Контакт</div>
                    <div>{order.contact_name || "—"}</div>
                    <div className="admin-order-sub">
                      {order.contact_phone || ""}
                    </div>
                  </div>
                  <div>
                    <div className="admin-order-label">Адрес</div>
                    <div>{order.address || "—"}</div>
                  </div>
                </div>

                <div className="admin-order-actions">
                  <label className="admin-order-label">Статус:</label>
                  <select
                    value={order.status}
                    onChange={(e) => changeStatus(order.id, e.target.value)}
                    className="admin-status-select"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}