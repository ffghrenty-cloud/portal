"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X, Bot, Trash2, Package, ExternalLink } from "lucide-react";

type ProductResult = {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  price: number;
  description: string | null;
  image_url: string | null;
  stock_quantity: number;
};

type Message = {
  role: "user" | "assistant";
  text: string;
  suggestions?: string[];
  products?: ProductResult[];
  provider?: "deepseek" | "fallback";
};

type AdminMsg = { id: number; text: string; is_from_admin: number; created_at: string };

const WELCOME: Message = {
  role: "assistant",
  text: "Здравствуйте! Я — ИИ-помощник оптового портала. Могу найти товары по названию, категории, артикулу, цене и наличию, а также помочь с вопросами по заказам.",
  suggestions: ["Каталог продукции", "Полотенца дешевле 30 BYN", "Постельное бельё в наличии", "Вызвать администратора"],
};

export default function Assistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"chat" | "admin">("chat");
  const [adminMessages, setAdminMessages] = useState<AdminMsg[]>([]);
  const [adminInput, setAdminInput] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, adminMessages, loading, adminLoading, mode]);

  async function loadAdminMessages() {
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      const data = await res.json();
      setAdminMessages(data.messages || []);
    } catch {}
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    const history = messages.slice(-10).map((message) => ({ role: message.role, content: message.text }));
    setMessages((current) => [...current, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMessages((current) => [...current, { role: "assistant", text: data.error || "Не удалось получить ответ. Попробуйте ещё раз." }]);
      } else {
        setMessages((current) => [...current, {
          role: "assistant",
          text: data.text,
          suggestions: data.suggestions,
          products: Array.isArray(data.products) ? data.products : [],
          provider: data.provider,
        }]);
      }
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "Ошибка соединения. Проверьте подключение и попробуйте ещё раз." }]);
    } finally {
      setLoading(false);
    }
  }

  async function sendToAdmin() {
    const text = adminInput.trim();
    if (!text) return;
    setAdminLoading(true);
    try {
      const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка отправки");
      else { setAdminInput(""); await loadAdminMessages(); }
    } catch { alert("Ошибка сети"); }
    finally { setAdminLoading(false); }
  }

  function clearBotHistory() {
    if (!confirm("Очистить историю чата с ИИ-помощником?")) return;
    setMessages([WELCOME]);
  }

  async function clearAdminHistory() {
    if (!confirm("Очистить всю историю переписки с администратором?")) return;
    try {
      const res = await fetch("/api/messages/clear", { method: "POST" });
      if (res.ok) setAdminMessages([]);
      else alert("Не удалось очистить историю");
    } catch { alert("Ошибка сети"); }
  }

  async function deleteMyMessage(id: number) {
    if (!confirm("Удалить это сообщение?")) return;
    try {
      const res = await fetch(`/api/messages/${id}`, { method: "DELETE" });
      if (res.ok) setAdminMessages((prev) => prev.filter((message) => message.id !== id));
      else alert("Не удалось удалить сообщение");
    } catch { alert("Ошибка сети"); }
  }

  function handleSuggestion(suggestion: string) {
    const routes: Record<string, string> = {
      "Перейти в каталог": "/catalog", "Каталог продукции": "/catalog", "Показать каталог": "/catalog",
      "Открыть мои заказы": "/orders", "Открыть документы": "/documents", "Документы": "/documents",
    };
    if (routes[suggestion]) { router.push(routes[suggestion]); setOpen(false); return; }
    if (suggestion === "Вызвать администратора") { setMode("admin"); loadAdminMessages(); return; }
    send(suggestion);
  }

  return (
    <>
      {!open && <button className="assistant-fab" onClick={() => setOpen(true)} aria-label="ИИ-помощник" type="button"><Bot size={22} /><span className="assistant-fab-label">ИИ-помощник</span></button>}
      {open && (
        <div className="assistant-window">
          <div className="assistant-header">
            <div className="assistant-header-info"><Bot size={18} /><b>{mode === "chat" ? "ИИ-помощник" : "Администратор"}</b></div>
            <div className="assistant-header-actions">
              {mode === "chat" && messages.length > 1 && <button className="assistant-clear" onClick={clearBotHistory} aria-label="Очистить историю" type="button" title="Очистить историю чата"><Trash2 size={16} /></button>}
              {mode === "admin" && adminMessages.length > 0 && <button className="assistant-clear" onClick={clearAdminHistory} aria-label="Очистить историю" type="button" title="Очистить всю историю"><Trash2 size={16} /></button>}
              <button className="assistant-close" onClick={() => mode === "admin" ? setMode("chat") : setOpen(false)} aria-label="Закрыть" type="button"><X size={18} /></button>
            </div>
          </div>
          {mode === "chat" ? (
            <>
              <div className="assistant-body" ref={bodyRef}>
                {messages.map((message, index) => (
                  <div key={index} className={`assistant-msg assistant-msg-${message.role}`}>
                    <div className="assistant-msg-text">{message.text}</div>
                    {message.provider && message.role === "assistant" && (
                      <div style={{ fontSize: 10, opacity: 0.65, marginTop: 5 }}>
                        {message.provider === "deepseek" ? "Ответ от DeepSeek" : "Резервный режим"}
                      </div>
                    )}
                    {message.products && message.products.length > 0 && (
                      <div style={{ display: "grid", gap: 9, marginTop: 10 }}>
                        {message.products.map((product) => (
                          <div key={product.id} style={{ display: "grid", gridTemplateColumns: "64px minmax(0,1fr)", gap: 9, padding: 9, border: "1px solid rgba(120,110,100,.2)", borderRadius: 10, background: "rgba(255,255,255,.55)" }}>
                            {product.image_url ? <img src={product.image_url} alt={product.name} style={{ width: 64, height: 72, objectFit: "cover", borderRadius: 7 }} /> : <div style={{ width: 64, height: 72, borderRadius: 7, display: "grid", placeItems: "center", background: "rgba(120,110,100,.1)" }}><Package size={22} /></div>}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 650, lineHeight: 1.35 }}>{product.name}</div>
                              <div style={{ fontSize: 10, opacity: .7, marginTop: 3 }}>{product.category || "Без категории"}{product.sku ? ` · ${product.sku}` : ""}</div>
                              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 5 }}>{Number(product.price).toFixed(2).replace(".", ",")} BYN</div>
                              <div style={{ fontSize: 10, marginTop: 2, color: product.stock_quantity > 0 ? "#28764a" : "#9a5a36" }}>{product.stock_quantity > 0 ? `Остаток: ${product.stock_quantity}` : "Наличие не подтверждено"}</div>
                              <button type="button" onClick={() => { router.push(`/catalog?q=${encodeURIComponent(product.sku || product.name)}`); setOpen(false); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, border: 0, borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 10, background: "#3f6656", color: "#fff" }}>
                                Открыть в каталоге <ExternalLink size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="assistant-suggestions">{message.suggestions.map((suggestion) => <button key={suggestion} className="assistant-suggestion" onClick={() => handleSuggestion(suggestion)} type="button">{suggestion}</button>)}</div>
                    )}
                  </div>
                ))}
                {loading && <div className="assistant-msg assistant-msg-assistant"><div className="assistant-msg-text assistant-typing">Ищу товары и формирую ответ<span>.</span><span>.</span><span>.</span></div></div>}
              </div>
              <form className="assistant-input" onSubmit={(event) => { event.preventDefault(); send(); }}>
                <input type="text" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Например: полотенца до 30 BYN..." maxLength={2000} />
                <button type="submit" disabled={loading || !input.trim()} aria-label="Отправить сообщение"><Send size={16} /></button>
              </form>
            </>
          ) : (
            <>
              <div className="assistant-body" ref={bodyRef}>
                <div className="assistant-admin-hint">Задайте вопрос администратору. Ответ придёт сюда же.</div>
                {adminMessages.length === 0 ? <div className="assistant-admin-empty">Сообщений пока нет</div> : adminMessages.map((message) => (
                  <div key={message.id} className={`assistant-msg ${message.is_from_admin ? "assistant-msg-assistant" : "assistant-msg-user"}`}>
                    <div className="assistant-msg-text">{message.text}{!message.is_from_admin && <button className="msg-delete-btn" onClick={() => deleteMyMessage(message.id)} aria-label="Удалить сообщение" title="Удалить сообщение" type="button"><Trash2 size={12} /></button>}</div>
                  </div>
                ))}
              </div>
              <form className="assistant-input" onSubmit={(event) => { event.preventDefault(); sendToAdmin(); }}>
                <input type="text" value={adminInput} onChange={(event) => setAdminInput(event.target.value)} placeholder="Ваш вопрос администратору..." />
                <button type="submit" disabled={adminLoading || !adminInput.trim()}><Send size={16} /></button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
