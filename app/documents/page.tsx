"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Download } from "lucide-react";

type Order = {
  id: number;
  status: string;
  total: number;
  created_at: string;
};

const DOC_TYPES = [
  {
    slug: "invoice",
    label: "Счета на оплату",
    desc: "Формируется после подтверждения заказа менеджером.",
  },
  {
    slug: "specification",
    label: "Спецификации заказа",
    desc: "Полный состав заказа с ценами и объёмами.",
  },
  {
    slug: "contract",
    label: "Договоры и приложения",
    desc: "Договор поставки и приложения к нему.",
  },
  {
    slug: "shipping",
    label: "Отгрузочные документы",
    desc: "ТТН, товарная накладная, акт приёмки.",
  },
];

export default function DocumentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/orders", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="static-page">
      <div className="static-container">
        <div className="static-header">
          <span className="eyebrow">ДОКУМЕНТЫ</span>
          <h1 className="static-title">Документооборот</h1>
          <p className="static-lead">
            Счета, спецификации, договоры и отгрузочные документы
            по вашим заказам — в одном месте.
          </p>
        </div>

        {/* Типы документов */}
        <section className="static-section">
          <h2 className="static-section-title">Типы документов</h2>
          <div className="static-grid-2">
            {DOC_TYPES.map((doc) => (
              <Link
                key={doc.slug}
                href={`/documents/${doc.slug}`}
                className="static-card static-card-icon doc-type-link"
              >
                <FileText size={24} />
                <h3>{doc.label}</h3>
                <p>{doc.desc}</p>
                <span className="doc-type-arrow">
                  Скачать <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Документы по заказам клиента */}
        <section className="static-section">
          <h2 className="static-section-title">Документы по вашим заказам</h2>

          {loading ? (
            <p>Загрузка...</p>
          ) : orders.length === 0 ? (
            <div className="static-empty">
              <FileText size={40} color="#9a938a" />
              <p>У вас пока нет заказов.</p>
              <Link href="/catalog" className="button dark">
                Перейти в каталог
              </Link>
            </div>
          ) : (
            <div className="static-table">
              <div
                className="static-table-head"
                style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}
              >
                <div>Заказ</div>
                <div>Дата</div>
                <div>Сумма</div>
                <div>Статус</div>
                <div>Документ</div>
              </div>
              {orders.map((o) => (
                <div
                  className="static-table-row"
                  key={o.id}
                  style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}
                >
                  <div>
                    <b>№{String(o.id).padStart(5, "0")}</b>
                  </div>
                  <div>
                    {new Date(o.created_at).toLocaleDateString("ru-RU")}
                  </div>
                  <div>{o.total.toFixed(2).replace(".", ",")} BYN</div>
                  <div>
                    {o.status === "pending"
                      ? "На согласовании"
                      : o.status === "confirmed"
                      ? "Подтверждён"
                      : o.status === "shipped"
                      ? "Отгружен"
                      : o.status}
                  </div>
                  <div>
                    <a
                      href={`/api/documents/invoice/${o.id}`}
                      className="static-link"
                      download
                    >
                      <Download size={14} /> Скачать
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="static-section">
          <p className="static-text">
            Документы формируются менеджером в течение рабочего дня
            после подтверждения заказа. Уведомление придёт на email.
          </p>
        </section>
      </div>
    </div>
  );
}