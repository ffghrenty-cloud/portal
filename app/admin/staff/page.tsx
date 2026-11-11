"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type Staff = { id: number; email: string; company: string | null; role: string; created_at: string };
const ROLES = [
  { value: "manager", label: "Менеджер" }, { value: "senior_manager", label: "Старший менеджер" },
  { value: "order_receiver", label: "Приёмщик заказов / проверка наличия" },
  { value: "warehouse", label: "Склад / комплектовщик" }, { value: "quality", label: "Контроль качества" },
  { value: "packer", label: "Упаковка" }, { value: "shipment_preparer", label: "Подготовка и загрузка отправки" }, { value: "logistics", label: "Логистика" },
];
const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор", manager: "Менеджер", senior_manager: "Старший менеджер", order_receiver: "Приёмщик заказов",
  warehouse: "Склад / комплектовщик", quality: "Контроль качества", packer: "Упаковка", shipment_preparer: "Подготовка отправки", logistics: "Логистика",
};
const fieldStyle: React.CSSProperties = { display: "block", width: "100%", marginTop: 6, padding: "10px 12px", border: "1px solid #d8d0c6", borderRadius: 4, background: "#fff" };

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [search, setSearch] = useState("");
  const filteredStaff = staff.filter(person => `${person.email} ${person.company || ""} ${ROLE_LABELS[person.role] || person.role} ${person.id}`.toLowerCase().includes(search.toLowerCase()));
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager"); const [company, setCompany] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const response = await fetch("/api/admin/staff", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setStaff(data.staff || []); else setMessage(data.error || "Не удалось загрузить сотрудников");
  }
  useEffect(() => { load(); }, []);
  async function createStaff(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/admin/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role, company }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(data.error || "Не удалось создать сотрудника"); return; }
    setEmail(""); setPassword(""); setCompany(""); setMessage("Учётная запись сотрудника создана"); load();
  }
  return <AdminGuard><AdminLayout>
    <div className="admin-header"><span className="eyebrow">АДМИНИСТРИРОВАНИЕ</span><h1 className="admin-title">Сотрудники и роли</h1>
      <p>Администраторы, менеджеры и сотрудники подразделений.</p></div>
    <form onSubmit={createStaff} style={{ display: "grid", gap: 14, maxWidth: 620, padding: 24, background: "#fff", border: "1px solid #e8e1d8", marginBottom: 28 }}>
      <h2 style={{ margin: 0 }}>Добавить сотрудника</h2>
      <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={fieldStyle} /></label>
      <label>Временный пароль<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} style={fieldStyle} /></label>
      <label>Должность<select value={role} onChange={e => setRole(e.target.value)} style={fieldStyle}>{ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
      <label>Подразделение / комментарий<input value={company} onChange={e => setCompany(e.target.value)} style={fieldStyle} /></label>
      <button disabled={busy} className="button dark" type="submit">{busy ? "Создание..." : "Создать учётную запись"}</button>
      {message && <p role="status">{message}</p>}
    </form>
    <h2 style={{ marginBottom: 14 }}>Список сотрудников</h2>
    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по email, подразделению или роли..." style={{ padding: 10, width: "100%", maxWidth: 460, marginBottom: 14, border: "1px solid #d8d0c6" }} />
    <p>Найдено: {filteredStaff.length}</p>
    <div className="admin-table">
      <div className="admin-table-head"><div>ID</div><div>Email</div><div>Подразделение</div><div>Роль</div><div>Добавлен</div></div>
      {filteredStaff.map(person => <div className="admin-table-row" key={person.id}><div>#{String(person.id).padStart(5, "0")}</div><div>{person.email}</div><div>{person.company || "—"}</div><div>{ROLE_LABELS[person.role] || person.role}</div><div>{new Date(person.created_at).toLocaleDateString("ru-RU")}</div></div>)}
      {staff.length === 0 && <p style={{ padding: 18 }}>Сотрудников пока нет.</p>}
    </div>
  </AdminLayout></AdminGuard>;
}
