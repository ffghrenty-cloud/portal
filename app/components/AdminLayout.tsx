"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  FileText,
  Package,
  Users,
  MessageCircle,
} from "lucide-react";

const MENU = [
  { href: "/admin", label: "Дашборд", icon: BarChart3 },
  { href: "/admin/orders", label: "Заказы", icon: FileText },
  { href: "/admin/products", label: "Товары", icon: Package },
  { href: "/admin/users", label: "Клиенты", icon: Users },
  { href: "/admin/messages", label: "Сообщения", icon: MessageCircle },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  // Загрузка счётчика при монтировании и при смене страницы
  useEffect(() => {
    fetch("/api/admin/messages/count", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setUnread(data.count || 0))
      .catch(() => setUnread(0));
  }, [pathname]);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">Админ-панель</div>
        <nav className="admin-nav">
          {MENU.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(item.href);
            const isMessages = item.href === "/admin/messages";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive ? "admin-nav-link active" : "admin-nav-link"
                }
              >
                <Icon size={18} />
                {item.label}
                {isMessages && unread > 0 && !isActive && (
                  <span className="admin-badge">{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}