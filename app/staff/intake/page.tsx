"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { orderItemId: number; name: string; sku: string | null; orderedQuantity: number; stockQuantity: number; availableQuantity: number | null; note: string | null };
type Order = { id: number; taskId: number; total: number; createdAt: string; customer: string; contactName: string | null; contactPhone: string | null; address: string | null; items: Item[] };

export default function StaffIntakePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/staff/intake", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setOrders(data.orders || []);
    else setMessage(data.error || "Не удалось загрузить заказы");
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  function setAvailable(orderId: number, itemId: number, value: number) {
    setOrders(current => current.map(order => order.id !== orderId ? order : {
      ...order,
      items: order.items.map(item => item.orderItemId !== itemId ? item : { ...item, availableQuantity: value })
    }));
  }
  function setNote(orderId: number, itemId: number, note: string) {
    setOrders(current => current.map(order => order.id !== orderId ? order : {
      ...order,
      items: order.items.map(item => item.orderItemId !== itemId ? item : { ...item, note })
    }));
  }
  async function submit(order: Order) {
    setBusy(order.id); setMessage("");
    const response = await fetch("/api/staff/intake", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, items: order.items.map(item => ({ orderItemId: item.orderItemId, availableQuantity: item.availableQuantity ?? Math.min(item.orderedQuantity, item.stockQuantity), note: item.note || "" })) })
    });
    const data = await response.json(); setBusy(null);
    if (!response.ok) setMessage(data.error || "Не удалось передать результат проверки");
    else { setMessage(`Заказ №${order.id} проверен и передан главному администратору / менеджеру`); await load(); }
  }
  return <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 22px", color: "#292722" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 28 }}>
      <div><span style={{ letterSpacing: 2, fontSize: 11 }}>РАБОЧЕЕ МЕСТО</span><h1 style={{ fontSize: 30, margin: "8px 0" }}>Приём новых заказов</h1><p style={{ color: "#777" }}>Проверьте остатки по каждой позиции и передайте результат дальше.</p></div>
      <Link href="/staff/tasks" style={{ color: "inherit" }}>Другие задания →</Link>
    </header>
    {message && <p role="status" style={{ padding: 12, background: "#f4f1eb" }}>{message}</p>}
    {loading ? <p>Загрузка...</p> : orders.length === 0 ? <p style={{ padding: 28, background: "#fff", border: "1px solid #e8e1d8" }}>Новых заказов на проверку нет.</p> :
      <div style={{ display: "grid", gap: 22 }}>
        {orders.map(order => <section key={order.id} style={{ background: "#fff", border: "1px solid #e8e1d8", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Заказ №{String(order.id).padStart(5, "0")}</h2><b>{Number(order.total).toFixed(2).replace(".", ",")} BYN</b>
          </div>
          <p>Покупатель: {order.customer} · Контакт: {order.contactName || "—"} · {order.contactPhone || "—"}</p>
          <p style={{ color: "#777" }}>Адрес: {order.address || "Не указан"}</p>
          <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
            {order.items.map(item => <div key={item.orderItemId} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) 140px 160px", gap: 12, alignItems: "end", padding: 12, background: "#f8f7f4" }}>
              <div><strong>{item.name}</strong><div style={{ color: "#777", fontSize: 12 }}>Артикул: {item.sku || "—"} · Заказано: {item.orderedQuantity} · Остаток: {item.stockQuantity}</div></div>
              <label>Доступно сейчас<input type="number" min="0" max={Math.min(item.orderedQuantity, item.stockQuantity)} value={item.availableQuantity ?? Math.min(item.orderedQuantity, item.stockQuantity)} onChange={e => setAvailable(order.id, item.orderItemId, Math.max(0, Number(e.target.value)))} style={{ display: "block", width: "100%", padding: 9, marginTop: 5, border: "1px solid #d8d0c6" }} /></label>
              <label>Примечание<input value={item.note || ""} onChange={e => setNote(order.id, item.orderItemId, e.target.value)} placeholder="Например, остаток в резерве" style={{ display: "block", width: "100%", padding: 9, marginTop: 5, border: "1px solid #d8d0c6" }} /></label>
            </div>)}
          </div>
          <button className="button dark" disabled={busy === order.id} onClick={() => submit(order)} style={{ marginTop: 18 }}>{busy === order.id ? "Передача..." : "Подтвердить наличие и передать заказ"}</button>
        </section>)}
      </div>}
  </main>;
}
