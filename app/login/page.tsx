"use client";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        setLoading(false);
        return;
      }
      if (!data.user?.id || !data.user?.role) {
        setError("Сервер не вернул данные пользователя. Повторите попытку.");
        setLoading(false);
        return;
      }
      const destinations: Record<string, string> = {
        admin: "/admin",
        client: "/profile",
        order_receiver: "/staff/intake",
        manager: "/staff/manager",
        senior_manager: "/staff/manager",
        warehouse_worker: "/staff/tasks",
        accountant: "/staff/tasks",
      };
      window.location.replace(destinations[data.user.role] || "/staff/tasks");
    } catch {
      setError("Не удалось выполнить вход. Проверьте подключение и попробуйте ещё раз.");
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-overlay" />
      <div className="auth-card">
        <span className="auth-eyebrow">Оптовый портал</span>
        <h1 className="auth-title">Вход</h1>
        <p className="auth-subtitle">Войдите в личный кабинет, чтобы оформить заявку или перейти к рабочим заданиям.</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">Email</label>
            <input id="login-email" type="email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" placeholder="you@company.by" />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">Пароль</label>
            <input id="login-password" type="password" className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" />
          </div>
          <button type="submit" className="auth-btn auth-btn-primary" disabled={loading}>{loading ? "Вход..." : "Войти"}</button>
        </form>
        <p className="auth-footer">Нет аккаунта? <Link href="/register">Зарегистрироваться</Link></p>
      </div>
    </div>
  );
}
