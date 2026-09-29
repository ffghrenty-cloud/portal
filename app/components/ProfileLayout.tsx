"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

const MENU = [
  { href: "/profile", label: "Обзор" },
  { href: "/orders", label: "Мои заказы" },
  { href: "/documents", label: "Документы" },
  { href: "/profile/requisites", label: "Мои реквизиты" },
  { href: "/profile/settings", label: "Настройки" },
];

export default function ProfileLayout() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="profile-menu">
      {MENU.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? "active" : ""}
        >
          {item.label}
        </Link>
      ))}
      <button
        className="profile-menu-logout"
        onClick={handleLogout}
        type="button"
      >
        <span>Выйти из аккаунта</span>
        <LogOut size={16} />
      </button>
    </nav>
  );
}