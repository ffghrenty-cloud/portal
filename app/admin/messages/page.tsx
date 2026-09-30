"use client";

import { useEffect, useRef, useState } from "react";
import AdminGuard from "@/app/components/AdminGuard";
import AdminLayout from "@/app/components/AdminLayout";
import {
  Send,
  ChevronDown,
  ChevronRight,
  User,
  Trash2,
} from "lucide-react";

type Message = {
  id: number;
  user_id: number;
  text: string;
  is_from_admin: number;
  is_read: number;
  created_at: string;
  user_email: string;
  user_company: string | null;
};

type UserGroup = {
  userId: number;
  email: string;
  company: string | null;
  messages: Message[];
  lastAt: string;
  unread: number;
};

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/admin/messages", { cache: "no-store" });
    const data = await res.json();
    setMessages(data.messages || []);
    setLoading(false);

    await fetch("/api/admin/messages/read", { method: "POST" });
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.scrollTop = dialogRef.current.scrollHeight;
    }
  }, [expanded, messages]);

  async function sendReply(userId: number) {
    const text = (reply[userId] || "").trim();
    if (!text) return;

    setReply((r) => ({ ...r, [userId]: "" }));

    await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, text }),
    });
    await load();

    requestAnimationFrame(() => {
      if (dialogRef.current) {
        dialogRef.current.scrollTop = dialogRef.current.scrollHeight;
      }
    });
  }

  async function deleteChat(userId: number) {
    if (!confirm("Удалить всю переписку с этим клиентом?")) return;
    try {
      const res = await fetch(`/api/admin/messages/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (expanded === userId) setExpanded(null);
        await load();
      } else {
        alert("Не удалось удалить чат");
      }
    } catch {
      alert("Ошибка сети");
    }
  }

  async function deleteAdminMessage(id: number) {
    if (!confirm("Удалить это сообщение?")) return;
    try {
      const res = await fetch(`/api/admin/messages/message/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      } else {
        alert("Не удалось удалить сообщение");
      }
    } catch {
      alert("Ошибка сети");
    }
  }

  const groups: UserGroup[] = [];
  const seen = new Map<number, UserGroup>();

  for (const m of messages) {
    if (!seen.has(m.user_id)) {
      const group: UserGroup = {
        userId: m.user_id,
        email: m.user_email,
        company: m.user_company,
        messages: [],
        lastAt: m.created_at,
        unread: 0,
      };
      seen.set(m.user_id, group);
      groups.push(group);
    }
    const g = seen.get(m.user_id)!;
    g.messages.push(m);
    if (!m.is_from_admin && m.is_read === 0) g.unread++;
    if (m.created_at > g.lastAt) g.lastAt = m.created_at;
  }

  groups.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

  for (const g of groups) {
    g.messages.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  }

  function toggleGroup(userId: number) {
    setExpanded((prev) => (prev === userId ? null : userId));
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    });
  }

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="admin-header">
          <span className="eyebrow">АДМИНИСТРИРОВАНИЕ</span>
          <h1 className="admin-title">Сообщения от клиентов</h1>
        </div>

        {loading ? (
          <p>Загрузка...</p>
        ) : groups.length === 0 ? (
          <div className="admin-empty">Пока нет сообщений</div>
        ) : (
          <div className="msg-list">
            {groups.map((group) => {
              const isOpen = expanded === group.userId;
              const lastMessage = group.messages[group.messages.length - 1];
              return (
                <div
                  key={group.userId}
                  className={isOpen ? "msg-item msg-item-open" : "msg-item"}
                >
                  <div
                    className="msg-item-head"
                    onClick={() => toggleGroup(group.userId)}
                  >
                    <div className="msg-item-icon">
                      <User size={18} />
                    </div>

                    <div className="msg-item-info">
                      <div className="msg-item-name">
                        {group.company || group.email}
                      </div>
                      <div className="msg-item-preview">
                        {lastMessage.is_from_admin ? "Вы: " : ""}
                        {lastMessage.text.length > 60
                          ? lastMessage.text.slice(0, 60) + "…"
                          : lastMessage.text}
                      </div>
                    </div>

                    <div className="msg-item-meta">
                      {group.unread > 0 && (
                        <span className="admin-badge">{group.unread}</span>
                      )}
                      <span className="msg-item-time">
                        {formatTime(lastMessage.created_at)}
                      </span>
                      <button
                        className="msg-item-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(group.userId);
                        }}
                        type="button"
                        title="Удалить чат"
                        aria-label="Удалить чат"
                      >
                        <Trash2 size={16} />
                      </button>
                      <span className="msg-item-chevron">
                        {isOpen ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="msg-item-body">
                      <div className="msg-dialog" ref={dialogRef}>
                        {group.messages.map((m) => (
                          <div
                            key={m.id}
                            className={`msg-bubble ${
                              m.is_from_admin
                                ? "msg-bubble-out"
                                : "msg-bubble-in"
                            }`}
                          >
                            <div className="msg-bubble-text">
                              {m.text}
                              {m.is_from_admin === 1 && (
                                <button
                                  className="msg-delete-btn msg-delete-btn-out"
                                  onClick={() => deleteAdminMessage(m.id)}
                                  aria-label="Удалить сообщение"
                                  title="Удалить сообщение"
                                  type="button"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                            <div className="msg-bubble-time">
                              {new Date(m.created_at).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <form
                        className="msg-reply"
                        onSubmit={(e) => {
                          e.preventDefault();
                          sendReply(group.userId);
                        }}
                      >
                        <input
                          type="text"
                          className="auth-input"
                          placeholder="Ответ клиенту..."
                          value={reply[group.userId] || ""}
                          onChange={(e) =>
                            setReply((r) => ({
                              ...r,
                              [group.userId]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="submit"
                          className="button dark"
                          disabled={!(reply[group.userId] || "").trim()}
                        >
                          <Send size={14} /> Отправить
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  );
}