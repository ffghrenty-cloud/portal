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
  tracking_carrier: string | null;
  tracking_number: string | null;
  estimated_delivery: string | null;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  coupon_code: string | null;
};

type OrderEvent = {
  id: number;
  status: string;
  title: string;
  description: string | null;
  actor_email: string | null;
  created_at: string;
};

type Review = { id: number; rating: number; comment: string | null; admin_reply: string | null; created_at: string };

type CustomerShipment = { id: number; status: string; carrier: string | null; trackingNumber: string | null; note: string | null; createdAt: string; shippedAt: string | null; items: Array<{ name: string; quantity: number }> };

type OrderNotification = {
  id: number;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
};

type OrderItem = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  shipped_quantity: number;
  price: number;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "draft" },
  pending: { label: "Ожидает проверки наличия", className: "pending" },
  stock_checked: { label: "Наличие проверено", className: "confirmed" },
  confirmed: { label: "Подтверждён", className: "confirmed" },
  production: { label: "В производстве", className: "pending" },
  ready: { label: "Готов к отгрузке", className: "confirmed" },
  warehouse: { label: "На складе", className: "pending" },
  picking: { label: "Комплектуется", className: "pending" },
  quality_check: { label: "Проверка качества", className: "pending" },
  packing: { label: "Упаковка", className: "pending" },
  partially_shipped: { label: "Отгружена часть заказа", className: "pending" },
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
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [fulfillments, setFulfillments] = useState<CustomerShipment[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    const loadOrder = () => {
      Promise.all([
        fetch(`/api/orders/${id}`, { cache: "no-store" }).then(res => res.json()),
        fetch(`/api/orders/${id}/review`, { cache: "no-store" }).then(res => res.json()),
      ]).then(([data, reviewData]) => {
        if (!active) return;
        if (data.error) setError(data.error);
        else {
          setOrder(data.order);
          setItems(data.items || []);
          setEvents(data.events || []);
          setNotifications(data.notifications || []);
          setFulfillments(data.fulfillments || []);
          setReview(reviewData.review || null);
        }
        setLoading(false);
      }).catch(() => {
        if (!active) return;
        setError("Не удалось загрузить заказ");
        setLoading(false);
      });
    };
    loadOrder();
    const refreshId = window.setInterval(loadOrder, 15000);
    return () => { active = false; window.clearInterval(refreshId); };
  }, [id]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault(); setReviewBusy(true); setReviewMessage("");
    const response = await fetch(`/api/orders/${id}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: reviewRating, comment: reviewComment })
    });
    const data = await response.json(); setReviewBusy(false);
    if (!response.ok) { setReviewMessage(data.error || "Не удалось отправить отзыв"); return; }
    const loaded = await fetch(`/api/orders/${id}/review`, { cache: "no-store" }).then(r => r.json());
    setReview(loaded.review || null); setReviewMessage("Спасибо! Отзыв сохранён.");
  }

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

        <section style={{ margin: "18px 0", padding: "18px 22px", background: "#fff", border: "1px solid #e8e1d8" }}>
          <h2 className="order-detail-section" style={{ marginBottom: 12 }}>Расчёт заказа</h2>
          <div className="profile-info-row"><span className="profile-info-label">Стоимость товаров</span><span className="profile-info-value">{formatPrice(order.subtotal || order.total)}</span></div>
          {Number(order.discount_percent) > 0 && <div className="profile-info-row"><span className="profile-info-label">Скидка по заказу ({order.discount_percent}%)</span><span className="profile-info-value">−{formatPrice(order.discount_amount || 0)}</span></div>}
          {order.coupon_code && <div className="profile-info-row"><span className="profile-info-label">Применённый промокод</span><span className="profile-info-value">{order.coupon_code}</span></div>}
          <div className="profile-info-row"><strong>Итого</strong><strong>{formatPrice(order.total)}</strong></div>
        </section>

        {/* Статус + дата */}
        <div className="order-detail-top">
          <div className={`profile-status ${statusInfo.className}`}>
            {statusInfo.label}
          </div>
          <div className="order-detail-date">
            Создан: {formatDate(order.created_at)}
          </div>
        </div>

        <section style={{ margin: "26px 0 18px", padding: "22px 24px", background: "#fff", border: "1px solid #e8e1d8" }}>
          <h2 className="order-detail-section" style={{ marginBottom: 16 }}>Отслеживание доставки</h2>
          <div className="profile-info-row"><span className="profile-info-label">Менеджер заказа</span><span className="profile-info-value">{order.manager || "Назначается после проверки наличия"}</span></div>
          <div className="profile-info-row"><span className="profile-info-label">Перевозчик</span><span className="profile-info-value">{order.tracking_carrier || "Ещё не назначен"}</span></div>
          <div className="profile-info-row"><span className="profile-info-label">Номер отправления</span><span className="profile-info-value">{order.tracking_number || "Появится после отгрузки"}</span></div>
          <div className="profile-info-row"><span className="profile-info-label">Ожидаемая доставка</span><span className="profile-info-value">{order.estimated_delivery ? new Date(order.estimated_delivery + "T00:00:00").toLocaleDateString("ru-RU") : "Дата уточняется"}</span></div>
          <small style={{ color: "#8b837a" }}>Статус и история обновляются автоматически каждые 15 секунд.</small>
        </section>

        {fulfillments.length > 0 && (
          <section style={{ margin: "18px 0", padding: "22px 24px", background: "#fff", border: "1px solid #e8e1d8" }}>
            <h2 className="order-detail-section" style={{ marginBottom: 14 }}>Отправления по заказу</h2>
            {fulfillments.map(shipment => <div key={shipment.id} style={{ padding: "14px 0", borderTop: "1px solid #eee" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>Отправление №{shipment.id}</strong>
                <span className={`profile-status ${shipment.status === "shipped" ? "shipped" : "pending"}`}>{shipment.status === "shipped" ? "Передано в доставку" : shipment.status === "delivered" ? "Доставлено" : shipment.status}</span>
              </div>
              <small style={{ color: "#8b837a" }}>Оформлено: {formatDate(shipment.createdAt)}{shipment.shippedAt ? ` · Отправлено: ${formatDate(shipment.shippedAt)}` : ""}</small>
              <p style={{ margin: "7px 0" }}>Перевозчик: {shipment.carrier || "Не указан"}</p>
              <p style={{ margin: "5px 0" }}>Трек-номер: <strong>{shipment.trackingNumber || "Ещё не присвоен"}</strong></p>
              {shipment.note && <p style={{ margin: "5px 0", color: "#716b64" }}>Комментарий: {shipment.note}</p>}
              <div style={{ marginTop: 8 }}>
                {shipment.items.map((item, index) => <div key={index}>{item.name}: {item.quantity} шт.</div>)}
              </div>
            </div>)}
          </section>
        )}

        {notifications.length > 0 && (
          <section style={{ margin: "18px 0", padding: "20px 24px", background: "#f7f5f1", border: "1px solid #e8e1d8" }}>
            <h2 className="order-detail-section" style={{ marginBottom: 14 }}>Уведомления по заказу</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {notifications.map((notification) => (
                <div key={notification.id}>
                  <strong>{notification.title}</strong>
                  <p style={{ margin: "4px 0", color: "#716b64" }}>{notification.message}</p>
                  <small style={{ color: "#8b837a" }}>{new Date(notification.created_at).toLocaleString("ru-RU")}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        {order.status === "delivered" && (
          <section style={{ margin: "18px 0", padding: "22px 24px", background: "#fff", border: "1px solid #e8e1d8" }}>
            <h2 className="order-detail-section" style={{ marginBottom: 14 }}>Отзыв о заказе</h2>
            {review ? <div>
              <div style={{ fontSize: 22, letterSpacing: 3 }}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
              <p>{review.comment || "Покупатель не добавил комментарий."}</p>
              {review.admin_reply && <div style={{ padding: 14, background: "#f7f5f1" }}><strong>Ответ компании</strong><p>{review.admin_reply}</p></div>}
            </div> : <form onSubmit={submitReview} style={{ display: "grid", gap: 12, maxWidth: 600 }}>
              <label>Оценка<select value={reviewRating} onChange={e => setReviewRating(Number(e.target.value))} style={{ display: "block", padding: 10, marginTop: 5 }}>
                {[5,4,3,2,1].map(value => <option key={value} value={value}>{"★".repeat(value)} ({value}/5)</option>)}
              </select></label>
              <label>Комментарий<textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} maxLength={2000} rows={4} style={{ display: "block", width: "100%", padding: 10, marginTop: 5 }} placeholder="Расскажите о качестве товара и обслуживании" /></label>
              <button className="button dark" disabled={reviewBusy}>{reviewBusy ? "Отправка..." : "Оставить отзыв"}</button>
              {reviewMessage && <p role="status">{reviewMessage}</p>}
            </form>}
          </section>
        )}

        <section style={{ margin: "18px 0 34px", padding: "24px", background: "#fff", border: "1px solid #e8e1d8" }}>
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
                    <small style={{ display: "block", color: "#8b837a" }}>Отправлено: {item.shipped_quantity || 0} из {item.quantity} шт.</small>
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