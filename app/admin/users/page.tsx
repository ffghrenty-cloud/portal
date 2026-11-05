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
          <h1 className="admin-title">Клиенты</h1>
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
            {users.map((u) => (
              <div className="admin-table-row" key={u.id}>
                <div>#{String(u.id).padStart(5, "0")}</div>
                <div>{u.email}</div>
                <div>{u.company || "—"}</div>
                <div>
                  <span className={`admin-role admin-role-${u.role}`}>
                    {u.role === "admin"
                      ? "Админ"
                      : u.role === "manager"
                      ? "Менеджер"
                      : "Клиент"}
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
