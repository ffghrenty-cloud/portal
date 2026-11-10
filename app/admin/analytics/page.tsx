"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type ProductStat = { product_id: number; name: string; units_sold: number; orders_count: number; revenue: number };
type MonthStat = { month: string; orders_count: number; revenue: number };
type CategoryStat = { category: string; units_sold: number; revenue: number };
type Data = { topProducts: ProductStat[]; monthlySales: MonthStat[]; categories: CategoryStat[]; summary: { orders_count: number; average_order: number; revenue: number; delivered_orders: number } };

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e8e1d8", padding: 22 };
const money = (n: number) => `${Number(n || 0).toFixed(2).replace(".", ",")} BYN`;

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/analytics", { cache: "no-store" }).then(r => r.json()).then(result => {
      if (result.error) setError(result.error); else setData(result);
    }).catch(() => setError("Не удалось загрузить аналитику"));
  }, []);
  const maxUnits = Math.max(1, ...(data?.topProducts || []).map(x => Number(x.units_sold)));
  const maxRevenue = Math.max(1, ...(data?.monthlySales || []).map(x => Number(x.revenue)));
  return <AdminGuard><AdminLayout>
    <div className="admin-header"><span className="eyebrow">ОТЧЁТЫ</span><h1 className="admin-title">Аналитика продаж</h1><p>Статистика учитывает только фактически отгруженные количества и выручку с учётом скидок.</p></div>
    {error && <p role="alert">{error}</p>}
    {!data ? !error && <p>Загрузка аналитики...</p> : <>
      <div className="admin-stats-grid">
        <div className="admin-stat-card"><div className="admin-stat-value">{data.summary.orders_count}</div><div className="admin-stat-label">Заказов с отгрузкой</div></div>
        <div className="admin-stat-card"><div className="admin-stat-value">{data.summary.delivered_orders}</div><div className="admin-stat-label">Доставлено</div></div>
        <div className="admin-stat-card"><div className="admin-stat-value">{money(data.summary.average_order)}</div><div className="admin-stat-label">Средний чек</div></div>
        <div className="admin-stat-card"><div className="admin-stat-value">{money(data.summary.revenue)}</div><div className="admin-stat-label">Сумма продаж</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, marginTop: 22 }}>
        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Что покупают чаще всего</h2>
          <p style={{ color: "#777", fontSize: 13 }}>Рейтинг товаров по количеству проданных единиц.</p>
          {data.topProducts.map((item, index) => <div key={item.product_id} style={{ margin: "18px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}><strong>{index + 1}. {item.name}</strong><b>{item.units_sold} шт.</b></div>
            <div style={{ height: 9, background: "#eeeae4", borderRadius: 8, overflow: "hidden" }}><div style={{ height: "100%", width: `${Number(item.units_sold) / maxUnits * 100}%`, background: "#88745d", borderRadius: 8 }} /></div>
            <small style={{ color: "#777" }}>{item.orders_count} заказов · {money(item.revenue)}</small>
          </div>)}
          {data.topProducts.length === 0 && <p>Пока недостаточно данных о покупках.</p>}
        </section>
        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Продажи по месяцам</h2>
          <p style={{ color: "#777", fontSize: 13 }}>Выручка и число заказов по фактическим отгрузкам за последние 12 месяцев.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(12px, 1fr))", gap: 7, alignItems: "end", height: 230, borderBottom: "1px solid #ddd", paddingTop: 12 }}>
            {data.monthlySales.map(month => <div key={month.month} title={`${month.month}: ${money(month.revenue)}, заказов: ${month.orders_count}`} style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "end", alignItems: "center", gap: 5 }}>
              <div style={{ width: "100%", height: `${Math.max(3, Number(month.revenue) / maxRevenue * 180)}px`, background: "#88745d", borderRadius: "4px 4px 0 0" }} />
              <small style={{ fontSize: 9, color: "#777", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{month.month.slice(2)}</small>
            </div>)}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "#777" }}>Наведите курсор на столбец, чтобы увидеть сумму и количество заказов.</div>
        </section>
      </div>
      <section style={{ ...card, marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>Популярные категории</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {data.categories.map(item => <div key={item.category} style={{ padding: 14, background: "#f7f5f1" }}><strong>{item.category}</strong><div style={{ marginTop: 8 }}>{item.units_sold} шт.</div><small style={{ color: "#777" }}>{money(item.revenue)}</small></div>)}
          {data.categories.length === 0 && <p>Нет данных по категориям.</p>}
        </div>
      </section>
    </>}
  </AdminLayout></AdminGuard>;
}
