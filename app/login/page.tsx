"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json(); setLoading(false);
      if (!res.ok) setError(data.error || "Ошибка входа");
      else {
        const destination = data.user?.role === "admin" ? "/admin" : data.user?.role === "client" ? "/profile" : data.user?.role === "order_receiver" ? "/staff/intake" : "/staff/tasks";
        router.push(destination); router.refresh();
      }
    } catch {
      setLoading(false); setError("Не удалось выполнить вход. Попробуйте ещё раз.");
    }
  }

  return <div className="auth-page"><div className="auth-bg" /><div className="auth-overlay" />
    <div className="auth-card">
      <span className="auth-eyebrow">Оптовый портал</span><h1 className="auth-title">Вход</h1>
      <p className="auth-subtitle">Войдите в личный кабинет, чтобы оформить заявку или перейти к рабочим заданиям.</p>
      {error && <div className="auth-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="auth-field"><label className="auth-label">Email</label><input type="email" className="auth-input" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.by" /></div>
        <div className="auth-field"><label className="auth-label">Пароль</label><input type="password" className="auth-input" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" /></div>
        <button type="submit" className="auth-btn auth-btn-primary" disabled={loading}>{loading ? "Вход..." : "Войти"}</button>
      </form>
      <p className="auth-footer">Нет аккаунта? <Link href="/register">Зарегистрироваться</Link></p>
    </div>
  </div>;
}
