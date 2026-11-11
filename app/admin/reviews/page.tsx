"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";

type ProductReview = { id: number; product_id: number; product_name: string; order_id: number; rating: number; comment: string | null; status: string; admin_reply: string | null; created_at: string; customer_email: string; customer_company: string | null };
type Review = { id: number; order_id: number; rating: number; comment: string | null; admin_reply: string | null; created_at: string; customer_email: string; customer_company: string | null };

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [productReviews, setProductReviews] = useState<ProductReview[]>([]);
  const [productReplies, setProductReplies] = useState<Record<number, string>>({});
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  async function load() {
    const [response, productResponse] = await Promise.all([
      fetch("/api/admin/reviews", { cache: "no-store" }),
      fetch("/api/admin/product-reviews", { cache: "no-store" }),
    ]);
    const data = await response.json();
    const productData = await productResponse.json();
    if (productResponse.ok) {
      setProductReviews(productData.reviews || []);
      setProductReplies(Object.fromEntries((productData.reviews || []).map((r: ProductReview) => [r.id, r.admin_reply || ""])));
    }
    if (response.ok) {
      setReviews(data.reviews || []);
      setReplies(Object.fromEntries((data.reviews || []).map((r: Review) => [r.id, r.admin_reply || ""])));
    } else setMessage(data.error || "Не удалось загрузить отзывы");
  }
  useEffect(() => { load(); }, []);

    async function updateProductReview(id: number, changes: { status?: string; reply?: string }) {
      const response = await fetch(`/api/admin/product-reviews/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes)
      });
      const data = await response.json();
      setMessage(response.ok ? "Отзыв обновлён" : data.error || "Не удалось обновить отзыв");
      if (response.ok) load();
    }

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

    <section style={{ marginTop: 36 }}>
      <h2 style={{ marginBottom: 14 }}>Отзывы о товарах</h2>
      <div style={{ display: "grid", gap: 14 }}>
        {productReviews.map(review => <article key={review.id} style={{ padding: 22, background: "#fff", border: "1px solid #e8e1d8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>{review.product_name}</strong>
            <span style={{ letterSpacing: 2, color: "#a16b2e" }}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span>
          </div>
          <p>{review.customer_company || review.customer_email} · Заказ №{review.order_id}</p>
          <p style={{ whiteSpace: "pre-wrap" }}>{review.comment}</p>
          <small>{new Date(review.created_at).toLocaleString("ru-RU")} · Статус: {review.status === "pending" ? "На проверке" : review.status === "approved" ? "Опубликован" : "Отклонён"}</small>
          <label style={{ display: "block", marginTop: 12 }}>Ответ компании
            <textarea rows={2} value={productReplies[review.id] || ""} onChange={e => setProductReplies(current => ({ ...current, [review.id]: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 6, padding: 10 }} />
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {review.status !== "approved" && <button className="button dark" onClick={() => updateProductReview(review.id, { status: "approved" })}>Опубликовать</button>}
            {review.status !== "rejected" && <button className="button" onClick={() => updateProductReview(review.id, { status: "rejected" })}>Отклонить</button>}
            <button className="button" onClick={() => updateProductReview(review.id, { reply: productReplies[review.id] || "" })}>Сохранить ответ</button>
          </div>
        </article>)}
        {productReviews.length === 0 && <p className="admin-empty">Отзывов о товарах пока нет.</p>}
      </div>
    </section>
  </AdminLayout></AdminGuard>;
}
