"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Check, Package, RefreshCw } from "lucide-react";
import ProfileLayout from "@/app/components/ProfileLayout";

type Notification = {
  id: number;
  order_id: number;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
  order_status: string | null;
};

function formatDate(value: string) {
  const date = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить уведомления");
      setItems(data.notifications || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки уведомлений");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markRead(id: number) {
    setBusyId(id);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось обновить уведомление");
      setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: 1 } : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка обновления");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось обновить уведомления");
      setItems((current) => current.map((item) => ({ ...item, is_read: 1 })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка обновления");
    } finally {
      setMarkingAll(false);
    }
  }

  const unread = items.filter((item) => !item.is_read).length;

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-head">
          <div>
            <span className="profile-eyebrow">Личный кабинет</span>
            <h1 className="profile-title">Уведомления</h1>
            <p style={{ color: "#777168", margin: "8px 0 0" }}>
              Обновления по заказам и отправлениям в одном месте.
            </p>
          </div>
          <div className="profile-actions">
            <Link href="/orders" className="button dark">Мои заказы</Link>
            <button className="button light" type="button" onClick={() => void load()}>
              <RefreshCw size={16} /> Обновить
            </button>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-sidebar"><ProfileLayout /></div>
          <div className="profile-main">
            <section className="notification-panel">
              <div className="notification-panel-head">
                <div>
                  <b>Все уведомления</b>
                  <span>{unread ? `${unread} непрочитанных` : "Всё просмотрено"}</span>
                </div>
                {unread > 0 && (
                  <button className="notification-mark-all" type="button" onClick={markAllRead} disabled={markingAll}>
                    <CheckCheck size={16} /> {markingAll ? "Обновление..." : "Прочитать все"}
                  </button>
                )}
              </div>

              {error && <div className="notification-error" role="alert">{error}</div>}
              {loading ? (
                <div className="profile-empty">Загрузка уведомлений...</div>
              ) : items.length === 0 ? (
                <div className="profile-empty">
                  <Bell size={26} />
                  <p>Пока нет уведомлений. Здесь появятся обновления о статусах и отправлениях ваших заказов.</p>
                </div>
              ) : (
                <div className="notification-list">
                  {items.map((item) => (
                    <article key={item.id} className={item.is_read ? "notification-card" : "notification-card unread"}>
                      <div className="notification-card-icon"><Package size={19} /></div>
                      <div className="notification-card-content">
                        <div className="notification-card-top">
                          <b>{item.title}</b>
                          <time>{formatDate(item.created_at)}</time>
                        </div>
                        <p>{item.message}</p>
                        <div className="notification-card-actions">
                          <Link href={`/orders/${item.order_id}`} className="notification-order-link">
                            Заказ №{String(item.order_id).padStart(5, "0")} · Подробнее
                          </Link>
                          {!item.is_read && (
                            <button type="button" onClick={() => void markRead(item.id)} disabled={busyId === item.id}>
                              <Check size={15} /> {busyId === item.id ? "Сохранение..." : "Прочитано"}
                            </button>
                          )}
                        </div>
                      </div>
                      {!item.is_read && <span className="notification-unread-dot" aria-label="Непрочитано" />}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
