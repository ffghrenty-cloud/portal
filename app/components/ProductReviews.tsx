"use client";

import { useState } from "react";
import { Star } from "lucide-react";

type Review = { id: number; rating: number; comment: string; admin_reply: string | null; created_at: string; reviewer_name: string | null };

export default function ProductReviews({ productId }: { productId: number }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch(`/api/products/${productId}/reviews`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) { setReviews(data.reviews || []); setAverage(data.average || 0); setCount(data.count || 0); setLoaded(true); }
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) await load();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch(`/api/products/${productId}/reviews`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment })
    });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(data.error || "Не удалось отправить отзыв"); return; }
    setComment(""); setMessage("Отзыв отправлен на проверку модератору.");
  }

  return <section style={{ marginTop: 14, borderTop: "1px solid #eee6dd", paddingTop: 10 }}>
    <button type="button" onClick={toggle} style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, color: "#76552f", fontSize: 13 }}>
      <Star size={15} /> Отзывы {loaded ? `(${count}) · ${average.toFixed(1)}/5` : ""} {open ? "−" : "+"}
    </button>
    {open && <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
      {reviews.map(review => <article key={review.id} style={{ padding: 10, background: "#faf8f5", borderRadius: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <strong style={{ fontSize: 12 }}>{review.reviewer_name || "Покупатель"}</strong>
          <span aria-label={`Оценка ${review.rating} из 5`} style={{ color: "#a16b2e" }}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span>
        </div>
        <p style={{ margin: "6px 0", fontSize: 13, whiteSpace: "pre-wrap" }}>{review.comment}</p>
        {review.admin_reply && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#62513f" }}><b>Ответ компании:</b> {review.admin_reply}</p>}
      </article>)}
      {!reviews.length && <small>Опубликованных отзывов пока нет.</small>}
      <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
        <b style={{ fontSize: 13 }}>Оставить отзыв о товаре</b>
        <select aria-label="Оценка товара" value={rating} onChange={e => setRating(Number(e.target.value))} style={{ padding: 8, border: "1px solid #d8d0c6", background: "white" }}>
          {[5,4,3,2,1].map(value => <option key={value} value={value}>{value} из 5 звёзд</option>)}
        </select>
        <textarea required minLength={5} maxLength={2000} value={comment} onChange={e => setComment(e.target.value)} placeholder="Расскажите о качестве товара..." rows={3} style={{ width: "100%", padding: 9, border: "1px solid #d8d0c6", resize: "vertical" }} />
        <button className="add-btn" type="submit" disabled={busy}>{busy ? "Отправка..." : "Отправить отзыв"}</button>
        {message && <small role="status">{message}</small>}
        <small>Оставить отзыв могут покупатели после получения товара. Публикация — после проверки.</small>
      </form>
    </div>}
  </section>;
}
