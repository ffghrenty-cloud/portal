"use client";

import { useState } from "react";
import { Star, MessageSquare, PenLine, CheckCircle2 } from "lucide-react";

type Review = {
  id: number;
  rating: number;
  comment: string;
  admin_reply: string | null;
  created_at: string;
  reviewer_name: string | null;
};

type Tab = "reviews" | "write";

export default function ProductReviews({ productId }: { productId: number }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("reviews");
  const [loaded, setLoaded] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить отзывы");
      setReviews(data.reviews || []);
      setAverage(data.average || 0);
      setCount(data.count || 0);
      setLoaded(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить отзывы");
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  }

  async function showReviews() {
    setOpen(true);
    setActiveTab("reviews");
    if (!loaded && !loading) await load();
  }

  async function showForm() {
    setOpen(true);
    setActiveTab("write");
    setMessage("");
    setMessageIsError(false);
    if (!loaded && !loading) await load();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отправить отзыв");
      setComment("");
      setMessage("Спасибо! Отзыв отправлен на проверку. После модерации он появится во вкладке «Отзывы».");
      setMessageIsError(false);
      setActiveTab("reviews");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось отправить отзыв");
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  const tabStyle = (selected: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "10px 13px",
    border: selected ? "1px solid #8a6338" : "1px solid #e7dfd5",
    borderRadius: 8,
    background: selected ? "#f5eee5" : "#fff",
    color: selected ? "#694a2a" : "#625b53",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  });

  return (
    <section style={{ marginTop: 14, borderTop: "1px solid #eee6dd", paddingTop: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={showReviews} style={tabStyle(open && activeTab === "reviews")}>
          <MessageSquare size={15} />
          Отзывы{loaded ? ` (${count})` : ""}
          {loaded && count > 0 && <span style={{ color: "#a16b2e" }}>★ {average.toFixed(1)}</span>}
        </button>
        <button type="button" onClick={showForm} style={tabStyle(open && activeTab === "write")}>
          <PenLine size={15} />
          Написать отзыв
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12, padding: 13, border: "1px solid #eee6dd", borderRadius: 10, background: "#fff" }}>
          {activeTab === "reviews" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <b style={{ fontSize: 14 }}>Отзывы покупателей</b>
                  {count > 0 && <div style={{ marginTop: 3, fontSize: 12, color: "#756b60" }}>Средняя оценка: {average.toFixed(1)} из 5 · {count} отзывов</div>}
                </div>
                <button type="button" onClick={showForm} style={{ ...tabStyle(false), background: "#76552f", color: "#fff", borderColor: "#76552f" }}>
                  <PenLine size={14} /> Оставить отзыв
                </button>
              </div>

              {loading && <p style={{ margin: 0, fontSize: 13, color: "#756b60" }}>Загружаем отзывы...</p>}
              {!loading && loaded && reviews.map((review) => (
                <article key={review.id} style={{ padding: 12, background: "#faf8f5", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13 }}>{review.reviewer_name || "Покупатель"}</strong>
                    <span aria-label={`Оценка ${review.rating} из 5`} style={{ color: "#a16b2e", letterSpacing: 1 }}>
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, color: "#54805a", fontSize: 11 }}>
                    <CheckCircle2 size={13} /> Покупка подтверждена
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{review.comment}</p>
                  {review.admin_reply && (
                    <div style={{ marginTop: 10, padding: "9px 11px", background: "#f1ece5", borderRadius: 6, fontSize: 12, color: "#62513f" }}>
                      <b>Ответ компании:</b> {review.admin_reply}
                    </div>
                  )}
                </article>
              ))}
              {!loading && loaded && reviews.length === 0 && (
                <div style={{ padding: 18, textAlign: "center", background: "#faf8f5", borderRadius: 8 }}>
                  <MessageSquare size={22} color="#a69a8b" />
                  <p style={{ margin: "7px 0 3px", fontSize: 13, fontWeight: 600 }}>Пока нет опубликованных отзывов</p>
                  <small style={{ color: "#756b60" }}>Станьте первым, кто поделится впечатлением о товаре.</small>
                </div>
              )}
              {message && <p role="status" style={{ margin: 0, fontSize: 12, color: messageIsError ? "#b42318" : "#39734a" }}>{message}</p>}
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
              <div>
                <b style={{ fontSize: 15 }}>Поделитесь впечатлением</b>
                <p style={{ margin: "4px 0 0", color: "#756b60", fontSize: 12 }}>Оцените товар и расскажите, что вам понравилось или что можно улучшить.</p>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 7, fontSize: 13, fontWeight: 600 }}>Ваша оценка</label>
                <div role="radiogroup" aria-label="Оценка товара" style={{ display: "flex", gap: 5 }}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={rating === value}
                      aria-label={`${value} из 5`}
                      onClick={() => setRating(value)}
                      style={{ display: "grid", justifyItems: "center", gap: 3, minWidth: 39, padding: "7px 5px", border: rating === value ? "1px solid #a16b2e" : "1px solid #e7dfd5", borderRadius: 7, background: rating === value ? "#f7efe5" : "#fff", color: rating === value ? "#a16b2e" : "#a69a8b", cursor: "pointer" }}
                    >
                      <Star size={21} fill={rating >= value ? "currentColor" : "none"} />
                      <span style={{ fontSize: 11 }}>{value}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor={`review-comment-${productId}`} style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Текст отзыва</label>
                <textarea
                  id={`review-comment-${productId}`}
                  required
                  minLength={5}
                  maxLength={2000}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Например: качество хорошее, товар соответствует описанию..."
                  rows={5}
                  style={{ boxSizing: "border-box", width: "100%", padding: 11, border: "1px solid #d8d0c6", borderRadius: 8, resize: "vertical", font: "inherit", fontSize: 13 }}
                />
                <div style={{ marginTop: 4, textAlign: "right", color: "#8b8176", fontSize: 11 }}>{comment.length}/2000</div>
              </div>

              {message && <p role="alert" style={{ margin: 0, fontSize: 12, color: messageIsError ? "#b42318" : "#39734a" }}>{message}</p>}

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <button className="add-btn" type="submit" disabled={busy || comment.trim().length < 5} style={{ minWidth: 170, opacity: busy || comment.trim().length < 5 ? 0.65 : 1 }}>
                  {busy ? "Отправляем..." : "Отправить отзыв"}
                </button>
                <small style={{ color: "#756b60", fontSize: 11 }}>Отзыв появится после проверки модератором.</small>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
