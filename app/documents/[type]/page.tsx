"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Download } from "lucide-react";

type Order = {
  id: number;
  status: string;
  total: number;
  created_at: string;
};

const TITLES: Record<string, string> = {
  invoice: "Счета на оплату",
  specification: "Спецификации заказа",
  contract: "Договоры и приложения",
  shipping: "Отгрузочные документы",
};

export default function DocumentTypePage() {
  const params = useParams();
  const type = (params?.type as string) || "invoice";

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

  const title = TITLES[type] || "Документы";

  return (
    <div className="static-page">
      <div className="static-container">
        <div className="static-header">
          <span className="eyebrow">ДОКУМЕНТЫ</span>
          <h1 className="static-title">{title}</h1>
          <p className="static-lead">
            Скачайте документ по любому из ваших заказов.
          </p>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <Link href="/documents" className="text-link">
            <ArrowLeft size={16} /> Ко всем документам
          </Link>
        </div>

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
              style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}
            >
              <div>Заказ</div>
              <div>Дата</div>
              <div>Сумма</div>
              <div>Документ</div>
            </div>
            {orders.map((o) => (
              <div
                className="static-table-row"
                key={o.id}
                style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}
              >
                <div>
                  <b>№{String(o.id).padStart(5, "0")}</b>
                </div>
                <div>{new Date(o.created_at).toLocaleDateString("ru-RU")}</div>
                <div>{o.total.toFixed(2).replace(".", ",")} BYN</div>
                <div>
                  <a
                    href={`/api/documents/${type}/${o.id}`}
                    className="static-link"
                    download
                  >
                    <Download size={14} /> Скачать PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}