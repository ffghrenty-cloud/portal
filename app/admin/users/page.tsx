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
              </div>
            ))}
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}