"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Check } from "lucide-react";
import { useCart } from "@/lib/useCart";
import MapPicker from "@/app/components/MapPicker";

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

function validatePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "Укажите телефон";
  if (!d.startsWith("375")) return "Номер должен начинаться с +375";
  if (d.length !== 12) return "Телефон должен содержать 12 цифр";
  if (!["25", "29", "33", "44"].includes(d.slice(3, 5)))
    return "Неверный код оператора (25, 29, 33, 44)";
  return "";
}

function hasVowels(w: string): boolean {
  return /[АЕЁИОУЫЭЮЯаеёиоуыэюяAEIOUYaeiouy]/.test(w);
}

function isValidWord(w: string): boolean {
  const t = w.trim();
  return t.length >= 2 && /^[А-Яа-яЁёA-Za-z-]+$/.test(t) && hasVowels(t);
}

function validateContactName(name: string): string {
  const t = name.trim();
  if (!t) return "Укажите контактное лицо";
  if (t.length < 3) return "Слишком короткое имя";
  if (!/^[А-Яа-яЁёA-Za-z][А-Яа-яЁёA-Za-z\s.\-]*$/.test(t))
    return "Только буквы, пробел, дефис, точка";
  if (!t.split(/[\s.\-]+/).some((w) => w.length > 1 && hasVowels(w)))
    return "Проверьте написание имени";
  return "";
}

function validateCity(city: string): string {
  const t = city.trim();
  if (!t) return "Укажите город";
  if (t.length < 3) return "Название города слишком короткое";
  if (/\d/.test(t)) return "Город не должен содержать цифры";
  if (!/^[А-Яа-яЁёA-Za-z\s-]+$/.test(t))
    return "Только буквы, пробел и дефис";
  const words = t.split(/[\s-]+/).filter(Boolean);
  if (words.length > 2) return "Город — одно слово";
  for (const w of words) {
    if (!isValidWord(w)) return "Проверьте название города";
  }
  return "";
}

function validateAddress(addr: string): string {
  const t = addr.trim();
  if (!t) return "Укажите адрес доставки";
  if (t.length < 8) return "Адрес слишком короткий";
  if (!/\d/.test(t)) return "Укажите номер дома";
  if (!/^[А-Яа-яЁёA-Za-z0-9\s.,\-/]+$/.test(t))
    return "Адрес содержит недопустимые символы";
  if (t.split(/[\s,.\-/]+/).filter(Boolean).length < 3)
    return "Укажите улицу и номер дома";
  const streetKeywords =
    /(ул\.?|улица|пр\.?|проспект|пр-т|пер\.?|переулок|шоссе|ш\.?|наб\.?|набережная|пл\.?|площадь|бульвар|б-р|туп\.?|тупик|проезд|кв\.?|квартира|оф\.?|офис|д\.?|дом|корп\.?|корпус|стр\.?|строение)/i;
  if (!streetKeywords.test(t))
    return "Укажите тип улицы (ул., пр., пер., шоссе и т.п.)";
  for (const w of t.split(/[\s,.\-/]+/).filter(Boolean)) {
    if (/^\d+$/.test(w)) continue;
    if (w.length < 2) continue;
    if (!/^[А-Яа-яЁёA-Za-z]+$/.test(w)) continue;
    if (!hasVowels(w)) return "Проверьте название улицы";
  }
  return "";
}

/* ==================== КОМПОНЕНТ ==================== */

export default function CheckoutPage() {
  const router = useRouter();
  const { items, formattedTotal, isEmpty, ready, clear } = useCart();

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);

  const [cityStatus, setCityStatus] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [cityDetails, setCityDetails] = useState<string>("");

  const [touched, setTouched] = useState({
    contactName: false,
    contactPhone: false,
    city: false,
    address: false,
  });

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) router.push("/login");
        else {
          setUser(data.user);
          if (data.user.company) setContactName(data.user.company);
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  async function checkCity() {
    const q = city.trim();
    if (q.length < 3) {
      setCityStatus("invalid");
      setCityDetails("Слишком короткое название");
      return;
    }
    setCityStatus("checking");
    setCityDetails("");

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(
          q
        )}`
      );
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setCityStatus("invalid");
        setCityDetails("Город не найден");
        return;
      }
      const place = data[0];
      const addr = place.address || {};
      const country = addr.country || "";
      const region = addr.state || addr.region || "";
      const cityName =
        addr.city ||
        addr.town ||
        addr.village ||
        place.display_name.split(",")[0];

      setCityDetails(
        `${cityName}${region ? ", " + region : ""}${country ? ", " + country : ""}`
      );
      setCityStatus("valid");
      if (cityName) setCity(cityName);
    } catch {
      setCityStatus("invalid");
      setCityDetails("Ошибка проверки — попробуйте позже");
    }
  }

 function handleMapSelect(data: {
  lat: number;
  lng: number;
  city: string;
  address: string;
  fullAddress: string;
  country?: string;
  region?: string;
}) {
  // Заполняем город
  if (data.city) {
    setCity(data.city);
    setCityStatus("valid");
    setCityDetails(
      [data.city, data.region, data.country].filter(Boolean).join(", ")
    );
  }

  // Заполняем адрес (улица + дом)
  if (data.address) {
    setAddress(data.address);
  } else if (data.fullAddress) {
    setAddress(data.fullAddress);
  }

  // Закрываем карту
  setShowMap(false);

  // Помечаем поля как "тронутые", чтобы ошибки исчезли
  setTouched((t) => ({ ...t, city: true, address: true }));
}

  const errors = useMemo(
    () => ({
      contactName: validateContactName(contactName),
      contactPhone: validatePhone(contactPhone),
      city: validateCity(city),
      address: validateAddress(address),
    }),
    [contactName, contactPhone, city, address]
  );

  const isFormValid =
    !errors.contactName &&
    !errors.contactPhone &&
    !errors.city &&
    !errors.address &&
    !isEmpty &&
    cityStatus === "valid";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTouched({
      contactName: true,
      contactPhone: true,
      city: true,
      address: true,
    });
    if (!isFormValid) return;

    setSubmitting(true);
    const payload = {
      items: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      address: `${city.trim()}, ${address.trim()}`,
      comment: comment.trim(),
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Ошибка оформления");
      return;
    }
    clear();
    router.push(`/orders/${data.orderId}`);
  }

  if (!ready) {
    return (
      <div className="checkout-page">
        <div className="checkout-container">
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="checkout-page">
        <div className="checkout-container">
          <div className="checkout-header">
            <div>
              <span className="eyebrow">ОФОРМЛЕНИЕ</span>
              <h1 className="checkout-title">Заявка</h1>
            </div>
            <Link href="/cart" className="text-link">
              <ArrowLeft size={16} /> К корзине
            </Link>
          </div>
          <div className="checkout-empty">
            <p>Корзина пуста — нечего оформлять.</p>
            <Link href="/catalog" className="button dark">
              Перейти в каталог
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <div className="checkout-header">
          <div>
            <span className="eyebrow">ОФОРМЛЕНИЕ</span>
            <h1 className="checkout-title">Оформление заявки</h1>
          </div>
          <Link href="/cart" className="text-link">
            <ArrowLeft size={16} /> К корзине
          </Link>
        </div>

        <div className="checkout-layout">
          <form className="checkout-form" onSubmit={handleSubmit} noValidate>
            {error && <div className="auth-error">{error}</div>}

            <div className="checkout-block">
              <h2 className="checkout-block-title">Контактные данные</h2>

              <div className="auth-field">
                <label className="auth-label">Контактное лицо *</label>
                <input
                  type="text"
                  className={
                    touched.contactName && errors.contactName
                      ? "auth-input input-error"
                      : "auth-input"
                  }
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  onBlur={() =>
                    setTouched((t) => ({ ...t, contactName: true }))
                  }
                  placeholder="Иванов И.И. или ООО «Ромашка»"
                />
                {touched.contactName && errors.contactName && (
                  <div className="field-error">{errors.contactName}</div>
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
                  value={contactPhone}
                  onChange={(e) => setContactPhone(formatPhone(e.target.value))}
                  onBlur={() =>
                    setTouched((t) => ({ ...t, contactPhone: true }))
                  }
                  placeholder="+375 (29) 123-45-67"
                />
                {touched.contactPhone && errors.contactPhone && (
                  <div className="field-error">{errors.contactPhone}</div>
                )}
              </div>

              <div className="auth-field">
                <label className="auth-label">Город *</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className={
                      touched.city && errors.city
                        ? "auth-input input-error"
                        : "auth-input"
                    }
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setCityStatus("idle");
                      setCityDetails("");
                    }}
                    onBlur={() => setTouched((t) => ({ ...t, city: true }))}
                    placeholder="Орша"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={checkCity}
                    disabled={cityStatus === "checking"}
                    className="button dark"
                    style={{ minHeight: "48px", padding: "0 20px" }}
                  >
                    {cityStatus === "checking" ? "..." : "Проверить"}
                  </button>
                </div>
                {cityStatus === "valid" && (
                  <div className="field-success">
                    <Check size={14} /> {cityDetails}
                  </div>
                )}
                {cityStatus === "invalid" && (
                  <div className="field-error">
                    {cityDetails || "Город не найден"}
                  </div>
                )}
                {touched.city && errors.city && cityStatus !== "valid" && (
                  <div className="field-error">{errors.city}</div>
                )}
              </div>

              <div className="auth-field">
                <label className="auth-label">Адрес доставки *</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className={
                      touched.address && errors.address
                        ? "auth-input input-error"
                        : "auth-input"
                    }
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onBlur={() =>
                      setTouched((t) => ({ ...t, address: true }))
                    }
                    placeholder="ул. Ленина, д. 15, офис 3"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMap(!showMap)}
                    className="button dark"
                    style={{ minHeight: "48px", padding: "0 16px" }}
                  >
                    <MapPin size={16} /> {showMap ? "Скрыть" : "На карте"}
                  </button>
                </div>
                {touched.address && errors.address && (
                  <div className="field-error">{errors.address}</div>
                )}
              </div>

              {showMap && (
                <div style={{ marginTop: "12px" }}>
                  <MapPicker
                    defaultCenter={[54.5133, 30.4034]}
                    onSelect={handleMapSelect}
                  />
                </div>
              )}

              <div className="auth-field">
                <label className="auth-label">Комментарий</label>
                <textarea
                  className="auth-input checkout-textarea"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Дополнительные пожелания, сроки, объёмы"
                  rows={4}
                />
              </div>
            </div>

            <button
              type="submit"
              className="auth-btn auth-btn-primary"
              disabled={submitting || !isFormValid}
            >
              {submitting ? "Отправка..." : "Отправить заявку"}
            </button>
          </form>

          <aside className="checkout-summary">
            <h2 className="checkout-summary-title">Состав заявки</h2>
            <div className="checkout-summary-list">
              {items.map((item) => (
                <div className="checkout-summary-row" key={item.productId}>
                  <div>
                    <div className="checkout-summary-name">{item.name}</div>
                    <div className="checkout-summary-qty">
                      {item.quantity} × {item.formattedPrice}
                    </div>
                  </div>
                  <b>{item.formattedSubtotal}</b>
                </div>
              ))}
            </div>
            <div className="cart-summary-total">
              <span>Итого</span>
              <b>{formattedTotal}</b>
            </div>
            <p className="checkout-summary-note">
              Менеджер свяжется с вами для подтверждения цены и сроков.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}