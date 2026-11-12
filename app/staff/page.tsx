"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type User = { id: number; email: string; role: string; company?: string | null };
type PanelLink = { href: string; title: string; description: string };

const ROLE_INFO: Record<string, { title: string; description: string; panels: PanelLink[] }> = {
  order_receiver: {
    title: "Приёмщик заказов",
    description: "Принимайте новые заказы, проверяйте свободные остатки и передавайте подтверждённые позиции менеджеру.",
    panels: [{ href: "/staff/intake", title: "Приёмка заказов", description: "Новые заказы, проверка наличия и передача менеджеру." }, { href: "/staff/tasks", title: "Мои задания", description: "История и текущие поручения, назначенные вам." }]
  },
  manager: {
    title: "Менеджер",
    description: "Принимайте назначенные заказы, согласовывайте наличие, ведите внутренние заметки и общайтесь с покупателями.",
    panels: [{ href: "/staff/manager", title: "Панель менеджера", description: "Очередь согласования, заметки и сообщения клиентам." }, { href: "/staff/tasks", title: "Мои задания", description: "Все этапы, назначенные лично вам." }]
  },
  senior_manager: {
    title: "Старший менеджер",
    description: "Распределяйте проверенные заказы между менеджерами и контролируйте собственную очередь.",
    panels: [{ href: "/staff/manager", title: "Панель старшего менеджера", description: "Распределение заказов и контроль назначений." }, { href: "/staff/tasks", title: "Мои задания", description: "Личные поручения и этапы обработки." }]
  },
  warehouse: {
    title: "Сотрудник склада",
    description: "Принимайте заказы на склад, выполняйте комплектацию и контролируйте складские остатки.",
    panels: [{ href: "/staff/tasks", title: "Задания склада", description: "Приёмка заказов и комплектация." }, { href: "/staff/warehouse", title: "Склад и остатки", description: "Оприходование, списание и журнал движений товаров." }]
  },
  quality: {
    title: "Контроль качества",
    description: "Принимайте задания на проверку качества и передавайте проверенные товары на упаковку.",
    panels: [{ href: "/staff/tasks", title: "Мои задания", description: "Проверка качества и завершение назначенных этапов." }]
  },
  packer: {
    title: "Упаковщик",
    description: "Принимайте заказы после контроля качества, отмечайте упаковку и передавайте их на подготовку к отправке.",
    panels: [{ href: "/staff/tasks", title: "Мои задания", description: "Очередь упаковки и завершение этапов." }]
  },
  shipment_preparer: {
    title: "Подготовка отправлений",
    description: "Принимайте заказы на подготовку, отмечайте загрузку и готовность к отправке.",
    panels: [{ href: "/staff/tasks", title: "Мои задания", description: "Подготовка и загрузка отправлений." }]
  },
  logistics: {
    title: "Логистика",
    description: "Принимайте отправления, оформляйте полные и частичные отгрузки, указывайте перевозчика и номер отправления.",
    panels: [{ href: "/staff/tasks", title: "Мои задания", description: "Оформление отправлений и контроль доставки." }]
  },
  admin: {
    title: "Администратор",
    description: "Управляйте заказами, сотрудниками, складом и настройками системы.",
    panels: [{ href: "/admin", title: "Панель администратора", description: "Заказы, товары, сотрудники, аналитика и настройки." }, { href: "/staff/tasks", title: "Все рабочие задания", description: "Просмотр и обработка назначенных этапов." }, { href: "/staff/warehouse", title: "Склад", description: "Остатки и движения товаров." }]
  }
};

export default function StaffHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/me", { cache: "no-store" })
      .then(async response => {
        if (response.status === 401) { router.replace("/login"); return null; }
        const data = await response.json();
        if (!response.ok || !data.user) throw new Error(data.error || "Не удалось определить роль сотрудника");
        return data.user as User;
      })
      .then(value => { if (active && value) setUser(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Не удалось загрузить рабочую панель"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [router]);

  if (loading) return <main style={{ maxWidth: 1000, margin: "0 auto", padding: 32 }}>Загрузка рабочей панели...</main>;
  if (error) return <main style={{ maxWidth: 1000, margin: "0 auto", padding: 32 }}><p role="alert">{error}</p><Link href="/profile">Вернуться в личный кабинет</Link></main>;
  if (!user) return null;

  const info = ROLE_INFO[user.role];
  if (!info) return <main style={{ maxWidth: 1000, margin: "0 auto", padding: 32 }}><h1>Рабочая панель недоступна</h1><p>Для аккаунта не назначена рабочая должность.</p><Link href="/profile">Личный кабинет</Link></main>;

  return <main style={{ maxWidth: 1100, margin: "0 auto", padding: "42px 22px 60px", color: "#292722" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 28 }}>
      <div><span className="eyebrow">РАБОЧЕЕ МЕСТО</span><h1 style={{ margin: "8px 0" }}>{info.title}</h1><p style={{ color: "#746d65", margin: 0 }}>{user.email}</p></div>
      <div style={{ display: "flex", gap: 14 }}><Link href="/profile" className="text-link">Личный кабинет</Link><Link href="/" className="text-link">На сайт</Link></div>
    </header>
    <p style={{ color: "#625d55", maxWidth: 760, lineHeight: 1.6 }}>{info.description}</p>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 24 }}>
      {info.panels.map(panel => <Link key={panel.href} href={panel.href} style={{ display: "block", padding: 22, border: "1px solid #e8e1d8", background: "#fff", color: "inherit", textDecoration: "none" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>{panel.title} →</h2><p style={{ margin: 0, color: "#746d65", lineHeight: 1.5 }}>{panel.description}</p>
      </Link>)}
    </section>
  </main>;
}
