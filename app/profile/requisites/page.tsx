"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type Requisites = {
  company: string;
  unp: string;
  legalAddress: string;
  bankName: string;
  bankAccount: string;
  contactPerson: string;
  contactPhone: string;
};

const EMPTY: Requisites = {
  company: "",
  unp: "",
  legalAddress: "",
  bankName: "",
  bankAccount: "",
  contactPerson: "",
  contactPhone: "",
};

/* ==================== ВАЛИДАЦИЯ ==================== */

function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("80")) digits = "375" + digits.slice(2);
  if (!digits.startsWith("375") && digits.length === 9) digits = "375" + digits;
  if (digits.startsWith("375")) {
    const code = digits.slice(3, 5);
    const p1 = digits.slice(5, 8);
    const p2 = digits.slice(8, 10);
    const p3 = digits.slice(10, 12);
    let r = "+375";
    if (code) r += ` (${code}`;
    if (code.length === 2) r += ")";
    if (p1) r += ` ${p1}`;
    if (p2) r += `-${p2}`;
    if (p3) r += `-${p3}`;
    return r;
  }
  return raw;
}

function formatAccount(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  if (cleaned.startsWith("BY")) {
    if (cleaned.length <= 2) return cleaned;
    const digits = cleaned.slice(2, 28);
    const groups = digits.match(/.{1,4}/g) || [];
    return ["BY", ...groups].join(" ");
  }

  if (/^\d+$/.test(cleaned)) {
    const digits = cleaned.slice(0, 20);
    const groups = digits.match(/.{1,4}/g) || [];
    return groups.join(" ");
  }

  return cleaned;
}

function validateUNP(unp: string): string {
  if (!unp) return "Укажите УНП";
  const digits = unp.replace(/\D/g, "");
  if (digits.length !== 9) return "УНП должен содержать 9 цифр";
  return "";
}

function validateBankName(name: string): string {
  const t = name.trim();
  if (!t) return "Укажите банк";
  if (t.length < 3) return "Слишком короткое название";
  if (!/[А-Яа-яЁёA-Za-z]/.test(t)) return "Название должно содержать буквы";
  return "";
}

function validateAccount(acc: string): string {
  if (!acc) return "Укажите расчётный счёт";
  const cleaned = acc.replace(/\s/g, "").toUpperCase();

  if (/^[A-Z]{2}/.test(cleaned)) {
    if (cleaned.startsWith("BY")) {
      const digits = cleaned.slice(2);
      if (!/^\d+$/.test(digits)) return "После BY — только цифры";
      if (digits.length !== 26)
        return "Для IBAN BY — 26 цифр после BY (всего 28 символов)";
      return "";
    }
    if (cleaned.length < 15 || cleaned.length > 34)
      return "Некорректная длина IBAN";
    return "";
  }

  if (/^\d+$/.test(cleaned)) {
    if (cleaned.length !== 20)
      return "Расчётный счёт должен содержать 20 цифр";
    return "";
  }

  return "Счёт должен содержать только цифры или начинаться с кода страны (BY)";
}

function hasVowels(w: string): boolean {
  return /[АЕЁИОУЫЭЮЯаеёиоуыэюяAEIOUYaeiouy]/.test(w);
}

function validateLegalAddress(addr: string): string {
  const t = addr.trim();

  if (!t) return "Укажите юридический адрес";
  if (t.length < 8) return "Адрес слишком короткий (минимум 8 символов)";

  if (!/^[А-Яа-яЁёA-Za-z0-9\s.,\-/]+$/.test(t))
    return "Адрес содержит недопустимые символы";

  if (!/\d/.test(t)) return "Укажите номер дома или офиса";
  if (!/[А-Яа-яЁёA-Za-z]/.test(t)) return "Адрес должен содержать буквы";

  const streetKeywords =
    /(ул\.?|улица|пр\.?|проспект|пр-т|пер\.?|переулок|шоссе|ш\.?|наб\.?|набережная|пл\.?|площадь|бульвар|б-р|туп\.?|тупик|проезд|кв\.?|квартира|оф\.?|офис|д\.?|дом|корп\.?|корпус|стр\.?|строение|микрорайон|мкр|г\.?|город|обл\.?|область)/i;
  if (!streetKeywords.test(t))
    return "Укажите тип улицы (ул., пр., пер., шоссе) или город";

  const words = t.split(/[\s,.\-/]+/).filter(Boolean);
  if (words.length < 2)
    return "Адрес слишком короткий (нужно минимум 2 слова)";

  for (const w of words) {
    if (/^\d+$/.test(w)) continue;
    if (w.length < 2) continue;
    if (/[0-9]/.test(w)) continue;
    if (/^[А-Яа-яЁёA-Za-z]+$/.test(w)) {
      if (!hasVowels(w))
        return "Проверьте написание адреса — нет гласных в слове";
    }
  }

  return "";
}

function validateContactPerson(name: string): string {
  const t = name.trim();
  if (!t) return "Укажите контактное лицо";
  if (t.length < 3) return "Слишком короткое имя";
  if (!/^[А-Яа-яЁёA-Za-z][А-Яа-яЁёA-Za-z\s.\-]*$/.test(t))
    return "Только буквы, пробел, дефис, точка";
  return "";
}

function validatePhone(raw: string): string {
  if (!raw) return "Укажите телефон";
  const d = raw.replace(/\D/g, "");
  if (!d.startsWith("375")) return "Номер должен начинаться с +375";
  if (d.length !== 12) return "Телефон должен содержать 12 цифр";
  if (!["25", "29", "33", "44"].includes(d.slice(3, 5)))
    return "Неверный код оператора (25, 29, 33, 44)";
  return "";
}

function validateCompany(name: string): string {
  const t = name.trim();
  if (!t) return "Укажите название компании";
  if (t.length < 2) return "Слишком короткое название";
  return "";
}

/* ==================== КОМПОНЕНТ ==================== */

export default function RequisitesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Requisites>(EMPTY);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const accountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) router.push("/login");
        else {
          setUser(data.user);
          if (data.user.company) {
            setForm((f) => ({ ...f, company: data.user.company }));
          }
        }
        setLoading(false);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const errors = useMemo(
    () => ({
      company: validateCompany(form.company),
      unp: validateUNP(form.unp),
      legalAddress: validateLegalAddress(form.legalAddress),
      bankName: validateBankName(form.bankName),
      bankAccount: validateAccount(form.bankAccount),
      contactPerson: validateContactPerson(form.contactPerson),
      contactPhone: validatePhone(form.contactPhone),
    }),
    [form]
  );

  const isValid = Object.values(errors).every((e) => !e);

  function markTouched(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function update<K extends keyof Requisites>(field: K, value: Requisites[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleAccountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const cursorPos = input.selectionStart ?? 0;
    const oldValue = input.value;
    const formatted = formatAccount(oldValue);

    const beforeCursor = oldValue.slice(0, cursorPos);
    const alnumBefore = beforeCursor.replace(/[^A-Za-z0-9]/g, "").length;

    update("bankAccount", formatted);

    requestAnimationFrame(() => {
      if (!accountInputRef.current) return;
      const newValue = accountInputRef.current.value;
      let count = 0;
      let newPos = newValue.length;
      for (let i = 0; i < newValue.length; i++) {
        if (/[A-Za-z0-9]/.test(newValue[i])) {
          count++;
          if (count === alnumBefore) {
            newPos = i + 1;
            break;
          }
        }
      }
      accountInputRef.current.setSelectionRange(newPos, newPos);
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setTouched({
      company: true,
      unp: true,
      legalAddress: true,
      bankName: true,
      bankAccount: true,
      contactPerson: true,
      contactPhone: true,
    });
    if (!isValid) return;

    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    setSaved(true);

    setTimeout(() => {
      router.push("/profile");
    }, 1200);
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
            <h1 className="profile-title">Мои реквизиты</h1>
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
            <form className="requisites-form" onSubmit={handleSave} noValidate>
              <div className="checkout-block">
                <h2 className="checkout-block-title">Данные компании</h2>

                <div className="auth-field">
                  <label className="auth-label">Название компании *</label>
                  <input
                    type="text"
                    className={
                      touched.company && errors.company
                        ? "auth-input input-error"
                        : "auth-input"
                    }
                    value={form.company}
                    onChange={(e) => update("company", e.target.value)}
                    onBlur={() => markTouched("company")}
                    placeholder="ООО «Ромашка»"
                  />
                  {touched.company && errors.company && (
                    <div className="field-error">{errors.company}</div>
                  )}
                </div>

                <div className="auth-field">
                  <label className="auth-label">УНП *</label>
                  <input
                    type="text"
                    className={
                      touched.unp && errors.unp
                        ? "auth-input input-error"
                        : "auth-input"
                    }
                    value={form.unp}
                    onChange={(e) =>
                      update("unp", e.target.value.replace(/\D/g, "").slice(0, 9))
                    }
                    onBlur={() => markTouched("unp")}
                    placeholder="123456789"
                    inputMode="numeric"
                  />
                  {touched.unp && errors.unp && (
                    <div className="field-error">{errors.unp}</div>
                  )}
                </div>

                <div className="auth-field">
                  <label className="auth-label">Юридический адрес *</label>
                  <input
                    type="text"
                    className={
                      touched.legalAddress && errors.legalAddress
                        ? "auth-input input-error"
                        : "auth-input"
                    }
                    value={form.legalAddress}
                    onChange={(e) => update("legalAddress", e.target.value)}
                    onBlur={() => markTouched("legalAddress")}
                    placeholder="г. Орша, ул. Ленина, д. 15, офис 3"
                  />
                  {touched.legalAddress && errors.legalAddress && (
                    <div className="field-error">{errors.legalAddress}</div>
                  )}
                </div>
              </div>

              <div className="checkout-block">
                <h2 className="checkout-block-title">Банковские данные</h2>

                <div className="auth-field">
                  <label className="auth-label">Банк *</label>
                  <input
                    type="text"
                    className={
                      touched.bankName && errors.bankName
                        ? "auth-input input-error"
                        : "auth-input"
                    }
                    value={form.bankName}
                    onChange={(e) => update("bankName", e.target.value)}
                    onBlur={() => markTouched("bankName")}
                    placeholder="ОАО «Приорбанк»"
                  />
                  {touched.bankName && errors.bankName && (
                    <div className="field-error">{errors.bankName}</div>
                  )}
                </div>

                <div className="auth-field">
                  <label className="auth-label">Расчётный счёт *</label>
                  <input
                    ref={accountInputRef}
                    type="text"
                    className={
                      touched.bankAccount && errors.bankAccount
                        ? "auth-input input-error"
                        : "auth-input"
                    }
                    value={form.bankAccount}
                    onChange={handleAccountChange}
                    onBlur={() => markTouched("bankAccount")}
                    placeholder="BY00 XXXX XXXX XXXX XXXX XXXX XXXX"
                    maxLength={36}
                  />
                  {touched.bankAccount && errors.bankAccount && (
                    <div className="field-error">{errors.bankAccount}</div>
                  )}
                </div>
              </div>

              <div className="checkout-block">
                <h2 className="checkout-block-title">Контактные лица</h2>

                <div className="auth-field">
                  <label className="auth-label">Контактное лицо *</label>
                  <input
                    type="text"
                    className={
                      touched.contactPerson && errors.contactPerson
                        ? "auth-input input-error"
                        : "auth-input"
                    }
                    value={form.contactPerson}
                    onChange={(e) => update("contactPerson", e.target.value)}
                    onBlur={() => markTouched("contactPerson")}
                    placeholder="Иванов Иван Иванович"
                  />
                  {touched.contactPerson && errors.contactPerson && (
                    <div className="field-error">{errors.contactPerson}</div>
                  )}
                </div>

                <div className="auth-field">
                  <label className="auth-label">Телефон *</label>
                  <input
                    type="tel"
                    className={
                      touched.contactPhone && errors.contactPhone
                        ? "auth-input input-error"
                        : "auth-input"
                    }
                    value={form.contactPhone}
                    onChange={(e) =>
                      update("contactPhone", formatPhone(e.target.value))
                    }
                    onBlur={() => markTouched("contactPhone")}
                    placeholder="+375 (29) 123-45-67"
                  />
                  {touched.contactPhone && errors.contactPhone && (
                    <div className="field-error">{errors.contactPhone}</div>
                  )}
                </div>
              </div>

              <div className="requisites-actions">
                <button
                  type="submit"
                  className="auth-btn auth-btn-primary"
                  disabled={saving || !isValid}
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>

                {saved && (
                  <div className="field-success">
                    <Check size={14} /> Сохранено
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}