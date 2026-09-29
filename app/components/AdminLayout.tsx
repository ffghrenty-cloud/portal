"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, Package, Users } from "lucide-react";

const MENU = [
  { href: "/admin", label: "Дашборд", icon: BarChart3 },
  { href: "/admin/orders", label: "Заказы", icon: FileText },
  { href: "/admin/products", label: "Товары", icon: Package },
  { href: "/admin/users", label: "Клиенты", icon: Users },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

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
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}