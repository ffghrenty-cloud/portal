"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type Review = { id: number; order_id: number; rating: number; comment: string | null; admin_reply: string | null; created_at: string; customer_email: string; customer_company: string | null };

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/admin/reviews", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) {
      setReviews(data.reviews || []);
      setReplies(Object.fromEntries((data.reviews || []).map((r: Review) => [r.id, r.admin_reply || ""])));
    } else setMessage(data.error || "Не удалось загрузить отзывы");
  }
  useEffect(() => { load(); }, []);
  async function reply(id: number) {
    const response = await fetch(`/api/admin/reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply: replies[id] || "" }) });
    const data = await response.json();
    setMessage(response.ok ? "Ответ сохранён" : data.error || "Не удалось сохранить ответ");
    if (response.ok) load();
  }
  return <AdminGuard><AdminLayout>
    <div className="admin-header"><span className="eyebrow">ОБРАТНАЯ СВЯЗЬ</span><h1 className="admin-title">Отзывы покупателей</h1></div>
    {message && <p role="status">{message}</p>}
    <div style={{ display: "grid", gap: 14 }}>
      {reviews.map(review => <article key={review.id} style={{ padding: 22, background: "#fff", border: "1px solid #e8e1d8" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>Заказ №{String(review.order_id).padStart(5, "0")}</strong><span style={{ letterSpacing: 2, color: "#a16b2e" }}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></div>
        <p>{review.customer_company || review.customer_email}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{review.comment || "Без комментария"}</p>
        <small style={{ color: "#777" }}>{new Date(review.created_at).toLocaleString("ru-RU")}</small>
        <label style={{ display: "block", marginTop: 14 }}>Ответ компании<textarea rows={3} value={replies[review.id] || ""} onChange={e => setReplies(current => ({ ...current, [review.id]: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }} /></label>
        <button className="button dark" style={{ marginTop: 10 }} onClick={() => reply(review.id)}>Сохранить ответ</button>
      </article>)}
      {reviews.length === 0 && <p className="admin-empty">Пока нет отзывов по доставленным заказам.</p>}
    </div>
  </AdminLayout></AdminGuard>;
}
