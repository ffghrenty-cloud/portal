"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type Coupon = { id: number; code: string; discount_percent: number; min_subtotal: number; max_uses: number | null; max_uses_per_user: number; usage_count: number; redemptions: number; starts_at: string | null; expires_at: string | null; is_active: number };
const field: React.CSSProperties = { width: "100%", padding: 10, border: "1px solid #d8d0c6", background: "#fff" };

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [minimum, setMinimum] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [perUser, setPerUser] = useState("1");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/coupons", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setCoupons(data.coupons || []); else setMessage(data.error || "Не удалось загрузить промокоды");
  }
  useEffect(() => { load(); }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/admin/coupons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, discountPercent: Number(percent), minSubtotal: Number(minimum), maxUses: maxUses || null, maxUsesPerUser: Number(perUser), startsAt: startsAt || null, expiresAt: expiresAt || null })
    });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(data.error || "Не удалось создать промокод"); return; }
    setCode(""); setMessage("Промокод создан"); await load();
  }

  async function toggle(coupon: Coupon) {
    const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !coupon.is_active })
    });
    const data = await response.json();
    setMessage(response.ok ? "Состояние промокода изменено" : data.error || "Ошибка");
    if (response.ok) load();
  }

  return <AdminGuard><AdminLayout>
    <div className="admin-header"><span className="eyebrow">МАРКЕТИНГ</span><h1 className="admin-title">Скидки и промокоды</h1><p>Процентные купоны с минимальной суммой, сроком действия и лимитами использования.</p></div>
    {message && <p role="status">{message}</p>}
    <form onSubmit={create} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, padding: 22, background: "#fff", border: "1px solid #e8e1d8", marginBottom: 28 }}>
      <h2 style={{ gridColumn: "1 / -1", margin: 0 }}>Создать промокод</h2>
      <label>Код<input required value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" maxLength={32} style={field} /></label>
      <label>Скидка, %<input required type="number" min="1" max="80" value={percent} onChange={e => setPercent(e.target.value)} style={field} /></label>
      <label>Минимальная сумма, BYN<input type="number" min="0" step="0.01" value={minimum} onChange={e => setMinimum(e.target.value)} style={field} /></label>
      <label>Общий лимит использований<input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Без ограничения" style={field} /></label>
      <label>На одного клиента<input required type="number" min="1" max="100" value={perUser} onChange={e => setPerUser(e.target.value)} style={field} /></label>
      <label>Действует с<input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} style={field} /></label>
      <label>Действует до<input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={field} /></label>
      <button className="button dark" type="submit" disabled={busy} style={{ alignSelf: "end" }}>{busy ? "Создание..." : "Создать промокод"}</button>
    </form>
    <h2 style={{ marginBottom: 14 }}>Созданные промокоды</h2>
    <div className="admin-table">
      <div className="admin-table-head"><div>Код</div><div>Скидка</div><div>Минимум</div><div>Использовано</div><div>Срок</div><div>Состояние</div></div>
      {coupons.map(coupon => <div className="admin-table-row" key={coupon.id}>
        <div><b>{coupon.code}</b></div><div>{coupon.discount_percent}%</div><div>{Number(coupon.min_subtotal).toFixed(2)} BYN</div>
        <div>{coupon.redemptions}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""}</div>
        <div>{coupon.starts_at || "Сразу"} — {coupon.expires_at || "Без срока"}</div>
        <div><button className="button" onClick={() => toggle(coupon)}>{coupon.is_active ? "Отключить" : "Включить"}</button></div>
      </div>)}
      {!coupons.length && <p style={{ padding: 18 }}>Промокодов пока нет.</p>}
    </div>
  </AdminLayout></AdminGuard>;
}
