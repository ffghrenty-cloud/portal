"use client";
import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email: email.trim(), password, company: company.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось зарегистрироваться.");
        setLoading(false);
        return;
      }
      if (!data.userId) {
        setError("Регистрация завершилась без данных пользователя. Попробуйте войти.");
        setLoading(false);
        return;
      }
      window.location.replace("/profile");
    } catch {
      setError("Не удалось выполнить регистрацию. Проверьте подключение и попробуйте ещё раз.");
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-overlay" />
      <div className="auth-card">
        <span className="auth-eyebrow">Оптовый портал</span>
        <h1 className="auth-title">Регистрация</h1>
        <p className="auth-subtitle">Создайте аккаунт оптового заказчика, чтобы получить доступ к персональным ценам и документам.</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="register-email">Email</label>
            <input id="register-email" type="email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" placeholder="you@company.by" />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="register-password">Пароль</label>
            <input id="register-password" type="password" className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" placeholder="Минимум 6 символов" />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="register-company">Компания</label>
            <input id="register-company" type="text" className="auth-input" value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" placeholder="ООО «Ваша компания»" />
          </div>
          <button type="submit" className="auth-btn auth-btn-primary" disabled={loading}>{loading ? "Регистрация..." : "Зарегистрироваться"}</button>
        </form>
        <p className="auth-footer">Уже есть аккаунт? <Link href="/login">Войти</Link></p>
      </div>
    </div>
  );
}
