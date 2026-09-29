"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

type Order = {
  id: number;
  status: string;
  total: number;
  contact_name: string | null;
  contact_phone: string | null;
  manager: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "draft" },
  pending: { label: "На согласовании", className: "pending" },
  confirmed: { label: "Подтверждён", className: "confirmed" },
  production: { label: "В производстве", className: "pending" },
  ready: { label: "Готов к отгрузке", className: "confirmed" },
  shipped: { label: "Отгружен", className: "shipped" },
  cancelled: { label: "Отменён", className: "draft" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  useEffect(() => {
    fetch("/api/orders", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = orders.filter((o) => {
    if (filter === "active") {
      return !["shipped", "cancelled"].includes(o.status);
    }
    if (filter === "done") {
      return ["shipped", "cancelled"].includes(o.status);
    }
    return true;
  });

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatTotal(total: number): string {
    return `${total.toFixed(2).replace(".", ",")} BYN`;
  }

  if (loading) {
    return (
      <div className="orders-page">
        <div className="orders-container">
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="orders-container">
        <div className="orders-header">
          <div>
            <span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span>
            <h1 className="orders-title">Мои заказы</h1>
          </div>
          <Link href="/catalog" className="text-link">
            В каталог <ArrowRight size={16} />
          </Link>
        </div>

        <div className="orders-filters">
          <button
            className={filter === "all" ? "filter active-filter" : "filter"}
            onClick={() => setFilter("all")}
          >
            Все ({orders.length})
          </button>
          <button
            className={filter === "active" ? "filter active-filter" : "filter"}
            onClick={() => setFilter("active")}
          >
            Активные
          </button>
          <button
            className={filter === "done" ? "filter active-filter" : "filter"}
            onClick={() => setFilter("done")}
          >
            Завершённые
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="orders-empty">
            <FileText size={48} color="#9a938a" />
            <p>У вас пока нет заказов.</p>
            <Link href="/catalog" className="button dark">
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="orders-list">
            {filtered.map((order) => {
              const statusInfo =
                STATUS_LABELS[order.status] || STATUS_LABELS.pending;
              return (
                <div className="order-row" key={order.id}>
                  <div className="order-num">
                    №{String(order.id).padStart(5, "0")}
                  </div>
                  <div className="order-date">
                    {formatDate(order.created_at)}
                  </div>
                  <div className="order-manager">
                    {order.manager || "Менеджер не назначен"}
                  </div>
                  <div className={`profile-status ${statusInfo.className}`}>
                    {statusInfo.label}
                  </div>
                  <div className="order-total">{formatTotal(order.total)}</div>
                  <Link
                    href={`/orders/${order.id}`}
                    className="order-detail"
                  >
                    Подробнее <ArrowRight size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}