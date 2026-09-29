"use client";

import { useCart } from "@/lib/useCart";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Menu,
  Search,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";

type User = {
  id: number;
  email: string;
  role: string;
  company: string | null;
};

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { count: cartCount, ready: cartReady } = useCart();

  // Перезапрашиваем пользователя при каждом изменении URL
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
        <div className="search-mini">
          <Search size={18} />
          <input placeholder="Поиск продукции" />
        </div>

        <button className="icon-btn" aria-label="Уведомления">
          <Bell size={20} />
        </button>

        <Link href="/cart" className="icon-btn cart-btn" aria-label="Заявка">
          <ShoppingCart size={20} />
          {cartReady && cartCount > 0 && (
    <span className="cart-count">{cartCount}</span>
  )}
        </Link>

      {loading ? (
  <div style={{ width: 120 }} />
) : user ? (
  <>
    {user.role === "admin" && (
      <Link href="/admin" className="header-admin-link">
        Админка
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