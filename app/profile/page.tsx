"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProfileLayout from "@/app/components/ProfileLayout";

type User = {
  id: number;
  email: string;
  role: string;
  company: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderStats, setOrderStats] = useState({ active: 0, total: 0, sum: 0 });

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
        else router.push("/login");
        setLoading(false);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    fetch("/api/orders", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const orders = data.orders || [];
        const active = orders.filter(
          (o: any) => !["shipped", "cancelled"].includes(o.status)
        ).length;
        const sum = orders.reduce((s: number, o: any) => s + o.total, 0);
        setOrderStats({ active, total: orders.length, sum });
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-empty">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const roleName =
    user.role === "admin"
      ? "Администратор"
      : user.role === "manager"
      ? "Менеджер"
      : "Оптовый заказчик";

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-head">
          <div>
            <span className="profile-eyebrow">Личный кабинет</span>
            <h1 className="profile-title">
              {user.company || "Оптовый заказчик"}
            </h1>
          </div>
          <div className="profile-actions">
            <Link href="/catalog" className="button dark">
              В каталог
            </Link>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-sidebar">
            <div className="profile-card">
              <span className="profile-card-title">Аккаунт</span>
              <p className="profile-company">
                {user.company || "Без компании"}
              </p>
              <p className="profile-role">{roleName}</p>

              <div style={{ marginTop: "24px" }}>
                <div className="profile-info-row">
                  <span className="profile-info-label">Email</span>
                  <span className="profile-info-value">{user.email}</span>
                </div>
                <div className="profile-info-row">
                  <span className="profile-info-label">ID клиента</span>
                  <span className="profile-info-value">
                    №{String(user.id).padStart(5, "0")}
                  </span>
                </div>
                <div className="profile-info-row">
                  <span className="profile-info-label">Статус</span>
                  <span className="profile-info-value">Активен</span>
                </div>
              </div>
            </div>

            <ProfileLayout />
          </div>

          <div className="profile-main">
            <div className="profile-stats">
              <div className="profile-stat">
                <b>{orderStats.active}</b>
                <span>Активных заказов</span>
              </div>
              <div className="profile-stat">
                <b>{orderStats.total}</b>
                <span>Всего заказов</span>
              </div>
              <div className="profile-stat">
                <b>{orderStats.sum.toFixed(0)} BYN</b>
                <span>Сумма заказов</span>
              </div>
            </div>

            <div className="profile-orders">
              <span className="profile-card-title">Последние заказы</span>

              <div className="profile-empty">
                У вас пока нет заказов.{" "}
                <Link href="/catalog">Перейти в каталог</Link>
              </div>
            </div>

            <div className="profile-orders">
              <span className="profile-card-title">Документы</span>

              <div className="profile-empty">
                Документов пока нет. Они появятся после оформления заказа.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}