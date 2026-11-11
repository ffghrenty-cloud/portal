"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProfileLayout from "@/app/components/ProfileLayout";
import { Star, MessageSquare, CheckCircle2, Clock3, AlertCircle } from "lucide-react";

type ReviewProduct = {
  product_id: number;
  product_name: string;
  image_url: string | null;
  quantity: number;
  delivered_at: string;
  review_id: number | null;
  rating: number | null;
  comment: string | null;
  review_status: "pending" | "approved" | "rejected" | null;
  admin_reply: string | null;
  review_created_at: string | null;
};

export default function MyReviewsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ReviewProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);
  const [notice, setNotice] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"available" | "sent">("available");

  async function loadProducts() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/profile/reviews", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить товары");
      setProducts(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProducts(); }, []);

  async function submitReview(productId: number) {
    const comment = (comments[productId] || "").trim();
    const rating = ratings[productId] || 5;
    if (comment.length < 5) {
      setNotice((prev) => ({ ...prev, [productId]: "Напишите отзыв минимум из 5 символов." }));
      return;
    }
    setSending(productId);
    setNotice((prev) => ({ ...prev, [productId]: "" }));
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отправить отзыв");
      setNotice((prev) => ({ ...prev, [productId]: "Отзыв отправлен на модерацию." }));
      await loadProducts();
      setActiveTab("sent");
    } catch (err) {
      setNotice((prev) => ({ ...prev, [productId]: err instanceof Error ? err.message : "Ошибка отправки" }));
    } finally {
      setSending(null);
    }
  }

  const available = products.filter((item) => !item.review_id);
  const sent = products.filter((item) => !!item.review_id);

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-head">
          <div>
            <span className="profile-eyebrow">Личный кабинет</span>
            <h1 className="profile-title">Мои отзывы</h1>
            <p style={{ color: "#756b60", marginTop: 6, fontSize: 14 }}>Оставляйте отзывы о товарах, которые уже получили.</p>
          </div>
          <Link href="/catalog" className="button dark">В каталог</Link>
        </div>

        <div className="profile-grid">
          <div className="profile-sidebar"><ProfileLayout /></div>
          <div className="profile-main">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              <button type="button" onClick={() => setActiveTab("available")} style={{ padding: "10px 15px", borderRadius: 8, border: activeTab === "available" ? "1px solid #76552f" : "1px solid #e5ddd3", background: activeTab === "available" ? "#f5eee5" : "#fff", color: "#5d472e", cursor: "pointer", fontWeight: 600 }}>
                Можно оценить ({available.length})
              </button>
              <button type="button" onClick={() => setActiveTab("sent")} style={{ padding: "10px 15px", borderRadius: 8, border: activeTab === "sent" ? "1px solid #76552f" : "1px solid #e5ddd3", background: activeTab === "sent" ? "#f5eee5" : "#fff", color: "#5d472e", cursor: "pointer", fontWeight: 600 }}>
                Мои отзывы ({sent.length})
              </button>
            </div>

            {loading && <div className="profile-empty">Загружаем список товаров...</div>}
            {error && <div className="profile-empty" role="alert">{error} <button type="button" onClick={() => void loadProducts()}>Повторить</button></div>}

            {!loading && !error && activeTab === "available" && (
              available.length ? (
                <div style={{ display: "grid", gap: 14 }}>
                  {available.map((item) => (
                    <article key={item.product_id} style={{ display: "grid", gridTemplateColumns: "92px minmax(0,1fr)", gap: 15, padding: 15, border: "1px solid #e9e1d8", borderRadius: 10, background: "#fff" }}>
                      <div style={{ width: 92, height: 92, borderRadius: 8, overflow: "hidden", background: "#f6f3ef", display: "grid", placeItems: "center" }}>
                        {item.image_url ? <img src={item.image_url} alt={item.product_name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <MessageSquare size={25} color="#a69a8b" />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: "2px 0 5px", fontSize: 15 }}>{item.product_name}</h3>
                        <small style={{ color: "#756b60" }}>Получено: {item.quantity} шт.</small>
                        <div style={{ marginTop: 12 }}>
                          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 7 }}>Ваша оценка</label>
                          <div style={{ display: "flex", gap: 5 }}>
                            {[1,2,3,4,5].map((value) => {
                              const selected = (ratings[item.product_id] || 5) >= value;
                              return <button key={value} type="button" aria-label={`${value} звёзд`} onClick={() => setRatings((prev) => ({ ...prev, [item.product_id]: value }))} style={{ border: 0, background: "transparent", color: selected ? "#b17b32" : "#d8d0c6", padding: 2, cursor: "pointer" }}><Star size={23} fill={selected ? "currentColor" : "none"} /></button>;
                            })}
                          </div>
                        </div>
                        <textarea value={comments[item.product_id] || ""} onChange={(event) => setComments((prev) => ({ ...prev, [item.product_id]: event.target.value.slice(0, 2000) }))} rows={3} maxLength={2000} placeholder="Расскажите о качестве товара, удобстве и впечатлениях..." style={{ boxSizing: "border-box", width: "100%", marginTop: 10, padding: 10, border: "1px solid #d8d0c6", borderRadius: 7, resize: "vertical", font: "inherit", fontSize: 13 }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 7 }}>
                          <small style={{ color: "#8b8176" }}>{(comments[item.product_id] || "").length}/2000 · минимум 5 символов</small>
                          <button type="button" className="add-btn" disabled={sending === item.product_id || (comments[item.product_id] || "").trim().length < 5} onClick={() => void submitReview(item.product_id)} style={{ opacity: sending === item.product_id || (comments[item.product_id] || "").trim().length < 5 ? .6 : 1 }}>{sending === item.product_id ? "Отправка..." : "Отправить отзыв"}</button>
                        </div>
                        {notice[item.product_id] && <p role="status" style={{ color: notice[item.product_id].includes("отправлен") ? "#39734a" : "#b42318", fontSize: 12, margin: "7px 0 0" }}>{notice[item.product_id]}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : <div className="profile-empty">Нет товаров, ожидающих отзыва. Отзыв можно оставить после получения заказа. <Link href="/orders">Посмотреть заказы</Link></div>
            )}

            {!loading && !error && activeTab === "sent" && (
              sent.length ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {sent.map((item) => (
                    <article key={item.product_id} style={{ padding: 15, border: "1px solid #e9e1d8", borderRadius: 10, background: "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <b>{item.product_name}</b>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: item.review_status === "approved" ? "#39734a" : item.review_status === "rejected" ? "#b42318" : "#986b2e" }}>
                          {item.review_status === "approved" ? <CheckCircle2 size={14} /> : item.review_status === "rejected" ? <AlertCircle size={14} /> : <Clock3 size={14} />}
                          {item.review_status === "approved" ? "Опубликован" : item.review_status === "rejected" ? "Отклонён" : "На модерации"}
                        </span>
                      </div>
                      <div style={{ marginTop: 7, color: "#b17b32" }}>{"★".repeat(item.rating || 0)}{"☆".repeat(5 - (item.rating || 0))}</div>
                      <p style={{ margin: "7px 0 0", whiteSpace: "pre-wrap", fontSize: 13 }}>{item.comment}</p>
                      {item.admin_reply && <div style={{ marginTop: 10, padding: 10, background: "#f6f2ec", borderRadius: 7, fontSize: 13 }}><b>Ответ магазина:</b> {item.admin_reply}</div>}
                      {item.review_status === "rejected" && <small style={{ display: "block", marginTop: 8, color: "#756b60" }}>Если вы считаете, что отзыв отклонён ошибочно, свяжитесь с администрацией.</small>}
                    </article>
                  ))}
                </div>
              ) : <div className="profile-empty">Вы ещё не оставляли отзывы.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
