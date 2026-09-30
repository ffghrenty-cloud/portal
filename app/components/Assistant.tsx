"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, X, Bot, Trash2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  text: string;
  suggestions?: string[];
};

type AdminMsg = {
  id: number;
  text: string;
  is_from_admin: number;
  created_at: string;
};

const WELCOME: Message = {
  role: "assistant",
  text: "Здравствуйте! Я — ИИ-помощник оптового портала. Помогу подобрать продукцию, расскажу про доставку, оплату и оптовые условия.",
  suggestions: [
    "Каталог продукции",
    "Оптовые цены",
    "Как оформить заказ?",
    "Вызвать администратора",
  ],
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
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
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
    if (!q) return;

    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: "Что-то пошло не так." },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: data.text, suggestions: data.suggestions },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Ошибка соединения." },
      ]);
    }
    setLoading(false);
  }

  async function sendToAdmin() {
    const text = adminInput.trim();
    if (!text) return;
    setAdminLoading(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Ошибка отправки");
      } else {
        setAdminInput("");
        await loadAdminMessages();
      }
    } catch {
      alert("Ошибка сети");
    }
    setAdminLoading(false);
  }

  function clearBotHistory() {
    if (!confirm("Очистить историю чата с ИИ-помощником?")) return;
    setMessages([WELCOME]);
  }

  async function clearAdminHistory() {
    if (!confirm("Очистить всю историю переписки с администратором?")) return;
    try {
      const res = await fetch("/api/messages/clear", { method: "POST" });
      if (res.ok) {
        setAdminMessages([]);
      } else {
        alert("Не удалось очистить историю");
      }
    } catch {
      alert("Ошибка сети");
    }
  }

  async function deleteMyMessage(id: number) {
    if (!confirm("Удалить это сообщение?")) return;
    try {
      const res = await fetch(`/api/messages/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAdminMessages((prev) => prev.filter((m) => m.id !== id));
      } else {
        alert("Не удалось удалить сообщение");
      }
    } catch {
      alert("Ошибка сети");
    }
  }

  function handleSuggestion(s: string) {
    const map: Record<string, string> = {
      "Перейти в каталог": "/catalog",
      "Каталог продукции": "/catalog",
      "Показать каталог": "/catalog",
      "Открыть мои заказы": "/orders",
      "Открыть документы": "/documents",
      "Документы": "/documents",
    };
    if (map[s]) {
      router.push(map[s]);
      setOpen(false);
      return;
    }
    if (s === "Вызвать администратора") {
      setMode("admin");
      loadAdminMessages();
      return;
    }
    send(s);
  }

  return (
    <>
      {!open && (
        <button
          className="assistant-fab"
          onClick={() => setOpen(true)}
          aria-label="ИИ-помощник"
          type="button"
        >
          <Bot size={22} />
          <span className="assistant-fab-label">ИИ-помощник</span>
        </button>
      )}

      {open && (
        <div className="assistant-window">
          <div className="assistant-header">
            <div className="assistant-header-info">
              <Bot size={18} />
              <b>{mode === "chat" ? "ИИ-помощник" : "Администратор"}</b>
            </div>

            <div className="assistant-header-actions">
              {mode === "chat" && messages.length > 1 && (
                <button
                  className="assistant-clear"
                  onClick={clearBotHistory}
                  aria-label="Очистить историю"
                  type="button"
                  title="Очистить историю чата"
                >
                  <Trash2 size={16} />
                </button>
              )}

              {mode === "admin" && adminMessages.length > 0 && (
                <button
                  className="assistant-clear"
                  onClick={clearAdminHistory}
                  aria-label="Очистить историю"
                  type="button"
                  title="Очистить всю историю"
                >
                  <Trash2 size={16} />
                </button>
              )}

              <button
                className="assistant-close"
                onClick={() => {
                  if (mode === "admin") {
                    setMode("chat");
                  } else {
                    setOpen(false);
                  }
                }}
                aria-label="Закрыть"
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {mode === "chat" ? (
            <>
              <div className="assistant-body" ref={bodyRef}>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`assistant-msg assistant-msg-${msg.role}`}
                  >
                    <div className="assistant-msg-text">{msg.text}</div>
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="assistant-suggestions">
                        {msg.suggestions.map((s) => (
                          <button
                            key={s}
                            className="assistant-suggestion"
                            onClick={() => handleSuggestion(s)}
                            type="button"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="assistant-msg assistant-msg-assistant">
                    <div className="assistant-msg-text assistant-typing">
                      Печатает<span>.</span><span>.</span><span>.</span>
                    </div>
                  </div>
                )}
              </div>

              <form
                className="assistant-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Задайте вопрос..."
                />
                <button type="submit" disabled={loading || !input.trim()}>
                  <Send size={16} />
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="assistant-body" ref={bodyRef}>
                <div className="assistant-admin-hint">
                  Задайте вопрос администратору. Ответ придёт сюда же.
                </div>

                {adminMessages.length === 0 ? (
                  <div className="assistant-admin-empty">
                    Сообщений пока нет
                  </div>
                ) : (
                  adminMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`assistant-msg ${
                        m.is_from_admin
                          ? "assistant-msg-assistant"
                          : "assistant-msg-user"
                      }`}
                    >
                      <div className="assistant-msg-text">
                        {m.text}
                        {!m.is_from_admin && (
                          <button
                            className="msg-delete-btn"
                            onClick={() => deleteMyMessage(m.id)}
                            aria-label="Удалить сообщение"
                            title="Удалить сообщение"
                            type="button"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                className="assistant-input"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendToAdmin();
                }}
              >
                <input
                  type="text"
                  value={adminInput}
                  onChange={(e) => setAdminInput(e.target.value)}
                  placeholder="Ваш вопрос администратору..."
                />
                <button
                  type="submit"
                  disabled={adminLoading || !adminInput.trim()}
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}