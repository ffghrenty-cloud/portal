"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type Stats = {
  total_orders: number;
  active_orders: number;
  total_clients: number;
  total_products: number;
  total_sum: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setStats(data.stats));
  }, []);

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="admin-header">
          <span className="eyebrow">АДМИНИСТРИРОВАНИЕ</span>
          <h1 className="admin-title">Дашборд</h1>
        </div>

        {!stats ? (
          <p>Загрузка...</p>
        ) : (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-value">{stats.total_orders}</div>
              <div className="admin-stat-label">Всего заказов</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{stats.active_orders}</div>
              <div className="admin-stat-label">Активных заказов</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{stats.total_clients}</div>
              <div className="admin-stat-label">Клиентов</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-value">{stats.total_products}</div>
              <div className="admin-stat-label">Товаров в каталоге</div>
            </div>
            <div className="admin-stat-card admin-stat-wide">
              <div className="admin-stat-value">
                {stats.total_sum.toFixed(2).replace(".", ",")} BYN
              </div>
              <div className="admin-stat-label">Сумма по всем заказам</div>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}