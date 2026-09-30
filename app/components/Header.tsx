"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Heart,
  Menu,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { useCart } from "@/lib/useCart";
import { useFavorites } from "@/lib/useFavorites";
import { Product } from "@/lib/Product";
import { ProductsApiClient } from "@/lib/ProductsApiClient";

type User = {
  id: number;
  email: string;
  role: string;
  company: string | null;
};

type Order = {
  id: number;
  status: string;
  total: number;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  pending: "На согласовании",
  confirmed: "Подтверждён",
  production: "В производстве",
  ready: "Готов к отгрузке",
  shipped: "Отгружен",
  cancelled: "Отменён",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Поиск
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);

  // Уведомления
  const [notifOpen, setNotifOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { count: cartCount, ready: cartReady } = useCart();
  const { count: favCount, ready: favReady } = useFavorites();

  // Пользователь
  useEffect(() => {
    setLoading(true);
    fetch("/api/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user || null);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, [pathname]);

  // Загрузка товаров при первом фокусе на поиск
  useEffect(() => {
    if (products.length > 0) return;
    const client = new ProductsApiClient();
    client.fetchAll().then(setProducts).catch(() => {});
  }, [products.length]);

  // Заказы для уведомлений
  useEffect(() => {
    if (!notifOpen || !user) return;
    setNotifLoading(true);
    fetch("/api/orders", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders || []);
        setNotifLoading(false);
      })
      .catch(() => setNotifLoading(false));
  }, [notifOpen, user]);

  // Закрытие выпадашек по клику вне
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Подсказки: до 6 товаров, соответствующих вводу
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [search, products]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`/catalog?q=${encodeURIComponent(q)}`);
    setSuggestOpen(false);
    setSearch("");
  }

  function handleSuggestionClick() {
    setSuggestOpen(false);
    setSearch("");
  }

  const activeOrders = orders.filter(
    (o) => !["shipped", "cancelled"].includes(o.status)
  );

  return (
    <header className="header">
      <Link className="brand" href="/">
        <span className="brand-main">ОРШАЛЁН</span>
        <span className="brand-sub">РУПТП «ОРШАНСКИЙ ЛЬНОКОМБИНАТ»</span>
      </Link>

      <nav className={menuOpen ? "nav nav-open" : "nav"}>
        <Link href="/" className={pathname === "/" ? "active" : ""}>
          Главная
        </Link>
        <Link
          href="/catalog"
          className={pathname?.startsWith("/catalog") ? "active" : ""}
        >
          Каталог
        </Link>
        <Link
          href="/orders"
          className={pathname?.startsWith("/orders") ? "active" : ""}
        >
          Мои заказы
        </Link>
        <Link href="/prices" className={pathname === "/prices" ? "active" : ""}>
          Цены
        </Link>
        <Link
          href="/documents"
          className={pathname?.startsWith("/documents") ? "active" : ""}
        >
          Документы
        </Link>
        <Link href="/about" className={pathname === "/about" ? "active" : ""}>
          О предприятии
        </Link>
      </nav>

      <div className="header-actions">
        {/* ПОИСК С ПОДСКАЗКАМИ */}
        <div className="search-wrap" ref={suggestRef}>
          <form className="search-mini" onSubmit={handleSearchSubmit}>
            <Search size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              placeholder="Поиск продукции"
            />
            {search && (
              <button
                type="button"
                className="search-clear"
                onClick={() => {
                  setSearch("");
                  setSuggestOpen(false);
                }}
                aria-label="Очистить"
              >
                <X size={14} />
              </button>
            )}
          </form>

          {suggestOpen && suggestions.length > 0 && (
            <div className="search-suggest">
              {suggestions.map((p) => (
                <Link
                  key={p.id}
                  href={`/catalog?q=${encodeURIComponent(p.name)}`}
                  className="suggest-item"
                  onClick={handleSuggestionClick}
                >
                  <div className="suggest-item-info">
                    <div className="suggest-item-category">{p.category}</div>
                    <div className="suggest-item-name">{p.name}</div>
                  </div>
                  <div className="suggest-item-price">
                    {p.formattedPrice}
                  </div>
                </Link>
              ))}
              <button
                type="submit"
                className="suggest-all"
                onClick={handleSearchSubmit as any}
              >
                Показать все результаты по «{search}» →
              </button>
            </div>
          )}
        </div>

        {/* УВЕДОМЛЕНИЯ */}
        <div className="notif-wrap" ref={notifRef}>
          <button
            className="icon-btn"
            aria-label="Уведомления"
            onClick={() => setNotifOpen(!notifOpen)}
          >
            <Bell size={20} />
            {user && activeOrders.length > 0 && (
              <span className="cart-count">{activeOrders.length}</span>
            )}
          </button>

          {notifOpen && (
            <div className="notif-dropdown">
              <div className="notif-head">
                <b>Уведомления</b>
                <button
                  className="notif-close"
                  onClick={() => setNotifOpen(false)}
                  aria-label="Закрыть"
                >
                  <X size={16} />
                </button>
              </div>

              {!user ? (
                <div className="notif-empty">
                  <p>Войдите, чтобы видеть уведомления</p>
                  <Link
                    href="/login"
                    className="button dark"
                    onClick={() => setNotifOpen(false)}
                  >
                    Войти
                  </Link>
                </div>
              ) : notifLoading ? (
                <div className="notif-empty">Загрузка...</div>
              ) : orders.length === 0 ? (
                <div className="notif-empty">
                  <p>Пока нет уведомлений</p>
                </div>
              ) : (
                <div className="notif-list">
                  {orders.slice(0, 5).map((o) => (
                    <Link
                      key={o.id}
                      href={`/orders/${o.id}`}
                      className="notif-item"
                      onClick={() => setNotifOpen(false)}
                    >
                      <div className="notif-item-head">
                        <b>Заказ №{String(o.id).padStart(5, "0")}</b>
                        <span className="notif-item-date">
                          {new Date(o.created_at).toLocaleDateString("ru-RU")}
                        </span>
                      </div>
                      <div className="notif-item-status">
                        {STATUS_LABELS[o.status] || o.status}
                      </div>
                    </Link>
                  ))}
                  <Link
                    href="/orders"
                    className="notif-all"
                    onClick={() => setNotifOpen(false)}
                  >
                    Все заказы →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ИЗБРАННОЕ */}
        <Link
          href="/favorites"
          className={
            pathname === "/favorites" ? "icon-btn cart-btn active" : "icon-btn cart-btn"
          }
          aria-label="Избранное"
        >
          <Heart size={20} />
          {favReady && favCount > 0 && (
            <span className="cart-count">{favCount}</span>
          )}
        </Link>

        {/* КОРЗИНА */}
        <Link href="/cart" className="icon-btn cart-btn" aria-label="Заявка">
          <ShoppingCart size={20} />
          {cartReady && cartCount > 0 && (
            <span className="cart-count">{cartCount}</span>
          )}
        </Link>

        {/* ПОЛЬЗОВАТЕЛЬ */}
        {loading ? (
          <div style={{ width: 120 }} />
        ) : user ? (
          <>
            {user.role === "admin" && (
              <Link href="/admin" className="header-admin-link">
                Админ-панель
              </Link>
            )}
            <Link href="/profile" className="login-btn">
              <UserRound size={18} />
              {user.company || "Личный кабинет"}
            </Link>
          </>
        ) : (
          <Link href="/login" className="login-btn">
            <UserRound size={18} /> Войти
          </Link>
        )}

        <button
          className="mobile-menu"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Меню"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}