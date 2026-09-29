"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import ProfileLayout from "@/app/components/ProfileLayout";

type User = {
  id: number;
  email: string;
  role: string;
  company: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSaved, setPwdSaved] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  const [emailNotify, setEmailNotify] = useState(true);
  const [notifySaved, setNotifySaved] = useState(false);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) router.push("/login");
        else setUser(data.user);
        setLoading(false);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdError("");
    setPwdSaved(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdError("Заполните все поля");
      return;
    }
    if (newPassword.length < 6) {
      setPwdError("Новый пароль — минимум 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("Пароли не совпадают");
      return;
    }

    setPwdSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setPwdSaving(false);
    setPwdSaved(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setPwdSaved(false), 2500);
  }

  function handleSaveNotifications() {
    setNotifySaved(true);
    setTimeout(() => setNotifySaved(false), 2000);
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-head">
          <div>
            <span className="profile-eyebrow">Личный кабинет</span>
            <h1 className="profile-title">Настройки</h1>
          </div>
          <div className="profile-actions">
            <Link href="/profile" className="button dark">
              <ArrowLeft size={16} /> Назад
            </Link>
          </div>
        </div>

        <div className="profile-grid">
          <div className="profile-sidebar">
            <ProfileLayout />
          </div>

          <div className="profile-main">
            <form className="settings-block" onSubmit={handleChangePassword}>
              <h2 className="checkout-block-title">Смена пароля</h2>

              {pwdError && <div className="auth-error">{pwdError}</div>}

              <div className="auth-field">
                <label className="auth-label">Текущий пароль</label>
                <input
                  type="password"
                  className="auth-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Новый пароль</label>
                <input
                  type="password"
                  className="auth-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Подтвердите пароль</label>
                <input
                  type="password"
                  className="auth-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите пароль"
                />
              </div>

              <div className="requisites-actions">
                <button
                  type="submit"
                  className="auth-btn auth-btn-primary"
                  disabled={pwdSaving}
                >
                  {pwdSaving ? "Сохранение..." : "Изменить пароль"}
                </button>
                {pwdSaved && (
                  <div className="field-success">
                    <Check size={14} /> Пароль обновлён
                  </div>
                )}
              </div>
            </form>

            <div className="settings-block">
              <h2 className="checkout-block-title">Уведомления</h2>

              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={emailNotify}
                  onChange={(e) => setEmailNotify(e.target.checked)}
                />
                <div>
                  <div className="settings-check-title">
                    Email-уведомления о заказах
                  </div>
                  <div className="settings-check-desc">
                    Получать письма при смене статуса заказа
                  </div>
                </div>
              </label>

              <div className="requisites-actions">
                <button
                  type="button"
                  className="auth-btn auth-btn-primary"
                  onClick={handleSaveNotifications}
                >
                  Сохранить
                </button>
                {notifySaved && (
                  <div className="field-success">
                    <Check size={14} /> Сохранено
                  </div>
                )}
              </div>
            </div>

            <div className="settings-block">
              <h2 className="checkout-block-title">Информация об аккаунте</h2>

              <div className="profile-info-row">
                <span className="profile-info-label">Email</span>
                <span className="profile-info-value">{user?.email}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Роль</span>
                <span className="profile-info-value">
                  {user?.role === "admin"
                    ? "Администратор"
                    : user?.role === "manager"
                    ? "Менеджер"
                    : "Оптовый заказчик"}
                </span>
              </div>
              {user?.company && (
                <div className="profile-info-row">
                  <span className="profile-info-label">Компания</span>
                  <span className="profile-info-value">{user.company}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}