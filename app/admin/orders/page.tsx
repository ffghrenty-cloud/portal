"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type Order = {
  id: number; user_id: number; status: string; total: number; contact_name: string | null;
  contact_phone: string | null; address: string | null; manager: string | null;
  created_at: string; user_email: string; user_company: string | null;
};

const STATUSES = [
  { value: "draft", label: "Черновик" }, { value: "pending", label: "Проверка наличия" },
  { value: "stock_checked", label: "Наличие проверено" }, { value: "confirmed", label: "Подтверждён" },
  { value: "production", label: "В производстве" }, { value: "warehouse", label: "На складе" },
  { value: "picking", label: "Комплектация" }, { value: "quality_check", label: "Контроль качества" },
  { value: "packing", label: "Упаковка" }, { value: "ready", label: "Готов к отгрузке" },
  { value: "partially_shipped", label: "Частично отгружен" }, { value: "shipped", label: "Отгружен" },
  { value: "delivered", label: "Доставлен" }, { value: "cancelled", label: "Отменён" },
];

const TRACK = [
  { label: "Оформлен", statuses: ["draft", "pending"] },
  { label: "Проверка", statuses: ["stock_checked"] },
  { label: "Менеджер", statuses: ["confirmed", "production"] },
  { label: "Склад", statuses: ["warehouse"] },
  { label: "Сборка", statuses: ["picking"] },
  { label: "Качество", statuses: ["quality_check"] },
  { label: "Упаковка", statuses: ["packing"] },
  { label: "Отгрузка", statuses: ["ready", "partially_shipped", "shipped"] },
  { label: "Доставка", statuses: ["delivered"] },
];

function statusLabel(status: string) {
  return STATUSES.find((item) => item.value === status)?.label || status;
}

function OrderProgress({ status }: { status: string }) {
  const current = TRACK.findIndex((step) => step.statuses.includes(status));
  const cancelled = status === "cancelled";
  return <div aria-label={cancelled ? "Заказ отменён" : `Этап: ${statusLabel(status)}`} style={{ display: "flex", alignItems: "flex-start", width: "100%", maxWidth: 320, paddingTop: 3 }}>
    {TRACK.map((step, index) => {
      const active = !cancelled && current >= 0 && index <= current;
      const currentStep = !cancelled && index === current;
      return <div key={step.label} style={{ display: "flex", alignItems: "center", flex: index === TRACK.length - 1 ? "0 0 auto" : "1 1 0", minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 12, gap: 5 }}>
          <span title={step.label} style={{ width: currentStep ? 11 : 8, height: currentStep ? 11 : 8, borderRadius: "50%", display: "block", background: active ? "#286b49" : "#d8d3cc", border: currentStep ? "2px solid #dcece2" : "none", boxSizing: "content-box", flexShrink: 0 }} />
          {currentStep && <small style={{ fontSize: 9, lineHeight: 1.1, color: "#286b49", whiteSpace: "nowrap", fontWeight: 700 }}>{step.label}</small>}
        </div>
        {index < TRACK.length - 1 && <span style={{ height: 2, background: active && current > index ? "#75a58a" : "#e5e1db", flex: 1, margin: "0 2px", marginTop: 4 }} />}
      </div>;
    })}
    {cancelled && <small style={{ marginLeft: 8, color: "#a33a32", fontWeight: 700 }}>Отменён</small>}
  </div>;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function loadOrders() {
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить заказы");
      setOrders(data.orders || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка загрузки заказов");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadOrders(); }, []);

  async function changeStatus(id: number, status: string) {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Не удалось изменить этап"); return; }
    await loadOrders();
  }

  const filtered = filter === "all" ? orders : orders.filter((order) => order.status === filter);

  return <AdminGuard><AdminLayout>
    <div className="admin-header" style={{ marginBottom: 16 }}>
      <span className="eyebrow">АДМИНИСТРИРОВАНИЕ</span>
      <h1 className="admin-title">Заказы клиентов</h1>
      <p style={{ marginTop: 5 }}>Компактный список заказов. Нажмите на заказ, чтобы открыть подробности.</p>
    </div>

    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 14 }}>Всего: {orders.length}</strong>
        <span style={{ color: "#8a837a", fontSize: 13 }}>· На экране показан краткий вид</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <label htmlFor="orders-filter" style={{ fontSize: 13, color: "#716b63" }}>Фильтр</label>
        <select id="orders-filter" value={filter} onChange={(event) => setFilter(event.target.value)} style={{ padding: "7px 10px", border: "1px solid #ddd5cb", background: "#fff", borderRadius: 6 }}>
          <option value="all">Все заказы ({orders.length})</option>
          {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button type="button" onClick={() => { setLoading(true); void loadOrders(); }} className="button dark" style={{ padding: "7px 12px" }}>Обновить</button>
      </div>
    </div>

    {error && <p role="alert" style={{ color: "#a12b2b", padding: 10, background: "#fff0ef" }}>{error}</p>}
    {loading ? <p>Загрузка...</p> : filtered.length === 0 ? <div className="admin-empty">Заказов нет</div> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))", gap: 6, alignItems: "start" }}>
        {filtered.map((order) => {
          const expanded = expandedId === order.id;
          return <section key={order.id} style={{ border: expanded ? "1px solid #b9cdbf" : "1px solid #e5e0d9", background: "#fff", borderRadius: 7, overflow: "hidden", minWidth: 0 }}>
            <button type="button" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : order.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 9px", border: 0, background: expanded ? "#f7faf7" : "#fff", textAlign: "left", cursor: "pointer", color: "inherit" }}>
              <span style={{ minWidth: 68, fontWeight: 750, fontSize: 14 }}>№{String(order.id).padStart(5, "0")}</span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: order.status === "cancelled" ? "#a33a32" : "#5e5a53", fontWeight: 600 }}>{statusLabel(order.status)}</span>
                <OrderProgress status={order.status} />
              </span>
              <span aria-hidden="true" style={{ color: "#766f66", fontSize: 18, marginLeft: 2 }}>{expanded ? "−" : "+"}</span>
            </button>

            {expanded && <div style={{ borderTop: "1px solid #eee9e2", padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: "12px 18px", fontSize: 13 }}>
                <div><div className="admin-order-label">Клиент</div><div>{order.user_company || order.user_email}</div></div>
                <div><div className="admin-order-label">Контакт</div><div>{order.contact_name || "—"}</div><div className="admin-order-sub">{order.contact_phone || ""}</div></div>
                <div><div className="admin-order-label">Адрес</div><div>{order.address || "—"}</div></div>
                <div><div className="admin-order-label">Ответственный менеджер</div><div>{order.manager || "Назначается автоматически"}</div></div>
                <div><div className="admin-order-label">Дата оформления</div><div>{new Date(order.created_at).toLocaleString("ru-RU")}</div></div>
                <div><div className="admin-order-label">Сумма</div><div style={{ fontWeight: 700 }}>{Number(order.total || 0).toFixed(2).replace(".", ",")} BYN</div></div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 14, paddingTop: 12, borderTop: "1px solid #eee9e2" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>
                  Этап:
                  <select value={order.status} onChange={(event) => void changeStatus(order.id, event.target.value)} style={{ padding: "6px 8px", border: "1px solid #d8d0c6", borderRadius: 5 }}>
                    {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <Link href={`/admin/orders/${order.id}/workflow`} className="text-link">Подробный маршрут и отгрузка →</Link>
                <Link href={`/admin/messages?userId=${order.user_id}`} className="text-link">Связаться с клиентом →</Link>
              </div>
            </div>}
          </section>;
        })}
      </div>}
  </AdminLayout></AdminGuard>;
}
