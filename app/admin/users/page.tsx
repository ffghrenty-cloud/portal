"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type User = {
  id: number;
  email: string;
  company: string | null;
  role: string;
  created_at: string;
  orders_count: number;
  orders_sum: number;
  discount_percent: number;
  discount_valid_until: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("client");
  const filteredUsers = users.filter(user => (roleFilter === "all" || user.role === roleFilter) && `${user.email} ${user.company || ""} ${user.id}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    fetch("/api/admin/users", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      });
  }, []);

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="admin-header">
          <span className="eyebrow">АДМИНИСТРИРОВАНИЕ</span>
          <h1 className="admin-title">Пользователи</h1>
          <p>Клиенты и сотрудники разделены фильтром по роли.</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по email, компании или ID..." style={{ padding: 10, minWidth: 260, border: "1px solid #d8d0c6" }} />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ padding: 10, border: "1px solid #d8d0c6" }}>
            <option value="client">Покупатели</option><option value="admin">Администраторы</option><option value="manager">Менеджеры</option><option value="senior_manager">Старшие менеджеры</option><option value="all">Все роли</option>
          </select>
          <span style={{ alignSelf: "center" }}>Найдено: {filteredUsers.length}</span>
        </div>
        {loading ? (
          <p>Загрузка...</p>
        ) : (
          <div className="admin-table">
            <div className="admin-table-head">
              <div>ID</div>
              <div>Email</div>
              <div>Компания</div>
              <div>Роль</div>
              <div>Заказов</div>
              <div>Скидка</div>
            </div>
            {filteredUsers.map((u) => (
              <div className="admin-table-row" key={u.id}>
                <div>#{String(u.id).padStart(5, "0")}</div>
                <div>{u.email}</div>
                <div>{u.company || "—"}</div>
                <div>
                  <span className={`admin-role admin-role-${u.role}`}>
                    {u.role === "admin" ? "Администратор" : u.role === "manager" ? "Менеджер" : u.role === "senior_manager" ? "Старший менеджер" : u.role === "client" ? "Клиент" : u.role}
                  </span>
                </div>
                <div>{u.orders_count}</div>
                <div>{u.role === "client" ? <DiscountEditor user={u} /> : "—"}</div>
              </div>
            ))}
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}

function DiscountEditor({ user }: { user: User }) {
  const [percent, setPercent] = useState(String(user.discount_percent || 0));
  const [until, setUntil] = useState(user.discount_valid_until || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discountPercent: Number(percent), discountValidUntil: until || null })
    });
    const data = await response.json(); setBusy(false);
    setMessage(response.ok ? "Сохранено" : data.error || "Ошибка");
  }
  return <div style={{ minWidth: 150, display: "grid", gap: 5 }}>
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <input aria-label="Скидка, процентов" type="number" min="0" max="80" value={percent} onChange={e => setPercent(e.target.value)} style={{ width: 58, padding: 5 }} /><span>%</span>
      <button className="text-link" onClick={save} disabled={busy}>{busy ? "..." : "Сохранить"}</button>
    </div>
    <input aria-label="Действует до" type="date" value={until} onChange={e => setUntil(e.target.value)} style={{ width: 145, padding: 5 }} />
    {message && <small>{message}</small>}
  </div>;
}
