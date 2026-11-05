"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Message = { id: number; text: string; is_from_admin: number; created_at: string };

export default function CustomerMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/messages", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить переписку");
      setMessages(data.messages || []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки переписки");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось отправить сообщение");
      setText(""); setNotice("Сообщение отправлено администратору."); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
    } finally { setSending(false); }
  }

  return <main style={{ maxWidth: 900, margin: "0 auto", padding: "38px 20px 60px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div><span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h1 style={{ margin: "8px 0 5px" }}>Связь с администрацией</h1><p style={{ color: "#777" }}>Задайте вопрос по заказу, оплате или доставке. Ответ появится здесь.</p></div>
      <Link href="/profile" className="text-link">В личный кабинет</Link>
    </div>
    <section style={{ background: "#fff", border: "1px solid #e8e1d8", padding: 18, minHeight: 300, display: "flex", flexDirection: "column", gap: 12 }}>
      {loading ? <p>Загрузка переписки...</p> : messages.length === 0 ? <p style={{ color: "#777" }}>Переписка пока пустая. Напишите нам, если нужна помощь.</p> :
        messages.map(message => <div key={message.id} style={{ alignSelf: message.is_from_admin ? "flex-start" : "flex-end", maxWidth: "85%", padding: "12px 15px", background: message.is_from_admin ? "#f3f0eb" : "#eaf2ec", borderRadius: 8 }}>
          <strong style={{ fontSize: 12 }}>{message.is_from_admin ? "Администратор" : "Вы"}</strong>
          <p style={{ margin: "5px 0", whiteSpace: "pre-wrap" }}>{message.text}</p>
          <small style={{ color: "#777" }}>{new Date(message.created_at).toLocaleString("ru-RU")}</small>
        </div>)}
    </section>
    {error && <p role="alert" style={{ color: "#a22" }}>{error}</p>}
    {notice && <p role="status" style={{ color: "#267044" }}>{notice}</p>}
    <form onSubmit={send} style={{ display: "grid", gap: 10, marginTop: 14 }}>
      <label htmlFor="message-text">Новое сообщение</label>
      <textarea id="message-text" value={text} onChange={e => setText(e.target.value)} maxLength={3000} rows={4} required placeholder="Напишите ваш вопрос..." style={{ padding: 12, border: "1px solid #ddd", borderRadius: 6, resize: "vertical" }} />
      <button className="button dark" disabled={sending || !text.trim()}>{sending ? "Отправка..." : "Отправить сообщение"}</button>
    </form>
  </main>;
}
