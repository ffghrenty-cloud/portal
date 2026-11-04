"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

type Order = {
  id: number;
  status: string;
  total: number;
  contact_name: string | null;
  contact_phone: string | null;
  address: string | null;
  comment: string | null;
  manager: string | null;
  created_at: string;
  updated_at: string;
};

type OrderEvent = {
  id: number;
  status: string;
  title: string;
  description: string | null;
  actor_email: string | null;
  created_at: string;
};

type OrderItem = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "draft" },
  pending: { label: "На согласовании", className: "pending" },
  confirmed: { label: "Подтверждён", className: "confirmed" },
  production: { label: "В производстве", className: "pending" },
  ready: { label: "Готов к отгрузке", className: "confirmed" },
  warehouse: { label: "На складе", className: "pending" },
  picking: { label: "Комплектуется", className: "pending" },
  quality_check: { label: "Проверка качества", className: "pending" },
  packing: { label: "Упаковка", className: "pending" },
  shipped: { label: "Отгружен", className: "shipped" },
  delivered: { label: "Доставлен", className: "shipped" },
  cancelled: { label: "Отменён", className: "draft" },
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/orders/${id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setOrder(data.order);
          setItems(data.items || []);
          setEvents(data.events || []);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Не удалось загрузить заказ");
        setLoading(false);
      });
  }, [id]);

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatPrice(p: number): string {
    return `${p.toFixed(2).replace(".", ",")} BYN`;
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

  if (error || !order) {
    return (
      <div className="orders-page">
        <div className="orders-container">
          <div className="orders-empty">
            <FileText size={48} color="#9a938a" />
            <p>{error || "Заказ не найден"}</p>
            <Link href="/orders" className="button dark">
              К списку заказов
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.pending;

  return (
    <div className="orders-page">
      <div className="orders-container">
        <div className="orders-header">
          <div>
            <span className="eyebrow">ЗАКАЗ</span>
            <h1 className="orders-title">
              №{String(order.id).padStart(5, "0")}
            </h1>
          </div>
          <Link href="/orders" className="text-link">
            <ArrowLeft size={16} /> К списку
          </Link>
        </div>

        {/* Статус + дата */}
        <div className="order-detail-top">
          <div className={`profile-status ${statusInfo.className}`}>
            {statusInfo.label}
          </div>
          <div className="order-detail-date">
            Создан: {formatDate(order.created_at)}
          </div>
        </div>

        <section style={{ margin: "26px 0 34px", padding: "24px", background: "#fff", border: "1px solid #e8e1d8" }}>
          <h2 className="order-detail-section" style={{ marginBottom: 22 }}>История и этапы выполнения</h2>
          {events.length === 0 ? (
            <p style={{ color: "#777" }}>История этапов пока не заполнена.</p>
          ) : (
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {events.map((event, index) => (
                <li key={event.id} style={{ display: "grid", gridTemplateColumns: "22px minmax(0, 1fr)", gap: 14, paddingBottom: index === events.length - 1 ? 0 : 22, position: "relative" }}>
                  <span style={{ width: 12, height: 12, marginTop: 5, borderRadius: "50%", background: index === events.length - 1 ? "#52765c" : "#b6a995", display: "block", zIndex: 1 }} />
                  <div>
                    <strong>{event.title}</strong>
                    {event.description && <p style={{ margin: "5px 0", color: "#716b64" }}>{event.description}</p>}
                    <small style={{ color: "#8b837a" }}>
                      {new Date(event.created_at).toLocaleString("ru-RU")}
                      {event.actor_email ? ` · ${event.actor_email}` : ""}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="order-detail-layout">
          {/* Левая колонка — товары */}
          <div className="order-detail-main">
            <h2 className="order-detail-section">Состав заказа</h2>

            <div className="order-detail-items">
              {items.map((item) => (
                <div className="order-detail-item" key={item.id}>
                  <div className="order-detail-item-name">
                    {item.product_name}
                  </div>
                  <div className="order-detail-item-qty">
                    {item.quantity} × {formatPrice(item.price)}
                  </div>
                  <div className="order-detail-item-subtotal">
                    {formatPrice(item.quantity * item.price)}
                  </div>
                </div>
              ))}
            </div>

            <div className="order-detail-total">
              <span>Итого:</span>
              <b>{formatPrice(order.total)}</b>
            </div>
          </div>

          {/* Правая колонка — данные заказа */}
          <aside className="order-detail-info">
            <h2 className="order-detail-section">Данные заказа</h2>

            <div className="profile-info-row">
              <span className="profile-info-label">Контактное лицо</span>
              <span className="profile-info-value">
                {order.contact_name || "—"}
              </span>
            </div>

            <div className="profile-info-row">
              <span className="profile-info-label">Телефон</span>
              <span className="profile-info-value">
                {order.contact_phone || "—"}
              </span>
            </div>

            <div className="profile-info-row">
              <span className="profile-info-label">Адрес доставки</span>
              <span className="profile-info-value">
                {order.address || "—"}
              </span>
            </div>

            <div className="profile-info-row">
              <span className="profile-info-label">Комментарий</span>
              <span className="profile-info-value">
                {order.comment || "—"}
              </span>
            </div>

            <div className="profile-info-row">
              <span className="profile-info-label">Менеджер</span>
              <span className="profile-info-value">
                {order.manager || "Ещё не назначен"}
              </span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}