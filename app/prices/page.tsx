"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function PricesPage() {
  return (
    <div className="static-page">
      <div className="static-container">
        <div className="static-header">
          <span className="eyebrow">ЦЕНЫ И УСЛОВИЯ</span>
          <h1 className="static-title">Оптовое ценообразование</h1>
          <p className="static-lead">
            Стоимость продукции рассчитывается индивидуально — с учётом объёма
            заказа, условий поставки и истории сотрудничества.
          </p>
        </div>

        <section className="static-section">
          <h2 className="static-section-title">Как формируется цена</h2>
          <div className="static-grid-2">
            <div className="static-card">
              <h3>Объём заказа</h3>
              <p>
                Чем больше партия, тем ниже цена за единицу.
                Минимальные объёмы указаны в карточках товаров.
              </p>
            </div>
            <div className="static-card">
              <h3>Регулярность</h3>
              <p>
                Постоянным заказчикам предоставляются дополнительные скидки
                и приоритетные условия.
              </p>
            </div>
            <div className="static-card">
              <h3>Условия поставки</h3>
              <p>
                Стоимость доставки, упаковки, отсрочки платежа
                учитываются отдельно.
              </p>
            </div>
            <div className="static-card">
              <h3>Ассортимент</h3>
              <p>
                На некоторые позиции действуют акционные цены
                и специальные предложения.
              </p>
            </div>
          </div>
        </section>

        <section className="static-section">
          <h2 className="static-section-title">Категории заказчиков</h2>
          <div className="static-table">
            <div className="static-table-head">
              <div>Категория</div>
              <div>Условия</div>
            </div>
            <div className="static-table-row">
              <div><b>Базовый</b></div>
              <div>Новые оптовые заказчики. Стандартный прайс.</div>
            </div>
            <div className="static-table-row">
              <div><b>Оптовый</b></div>
              <div>Регулярные заказы от 30 м / 10 кг. Скидка до 5%.</div>
            </div>
            <div className="static-table-row">
              <div><b>VIP</b></div>
              <div>Крупные объёмы, долгосрочные договоры. Скидка до 15%.</div>
            </div>
          </div>
        </section>

        <section className="static-section">
          <h2 className="static-section-title">Как получить персональную цену</h2>
          <ol className="static-list">
            <li>Зарегистрируйтесь как оптовый заказчик.</li>
            <li>Добавьте товары в корзину и оформите заявку.</li>
            <li>Менеджер свяжется с вами и подтвердит цену.</li>
            <li>После согласования цена фиксируется в заказе.</li>
          </ol>
          <div className="static-actions">
            <Link href="/register" className="button dark">
              Зарегистрироваться <ArrowRight size={16} />
            </Link>
            <Link href="/catalog" className="button light" style={{ color: "#292722", borderColor: "#292722" }}>
              Смотреть каталог
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}