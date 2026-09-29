"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="static-page">
      <div className="static-container">
        <div className="static-header">
          <span className="eyebrow">О ПРЕДПРИЯТИИ</span>
          <h1 className="static-title">Оршанский льнокомбинат</h1>
          <p className="static-lead">
            Одно из старейших предприятий лёгкой промышленности Беларуси.
            С 1930 года производим натуральные льняные ткани, пряжу
            и готовые изделия.
          </p>
        </div>

        <section className="static-section">
          <h2 className="static-section-title">История</h2>
          <div className="static-grid-3">
            <div className="static-stat">
              <b>1930</b>
              <span>год основания</span>
            </div>
            <div className="static-stat">
              <b>90+</b>
              <span>лет производства</span>
            </div>
            <div className="static-stat">
              <b>30+</b>
              <span>видов продукции</span>
            </div>
          </div>
          <p className="static-text">
            Комбинат прошёл путь от небольшой ткацкой фабрики до современного
            предприятия полного цикла: от переработки льноволокна до выпуска
            готовой продукции. Сегодня «Оршанский льнокомбинат» — один
            из крупнейших производителей льняных тканей в СНГ.
          </p>
        </section>

        <section className="static-section">
          <h2 className="static-section-title">Производство</h2>
          <div className="static-grid-2">
            <div className="static-card">
              <h3>Полный цикл</h3>
              <p>
                От чесания льноволокна до отбеливания, окрашивания
                и пошива готовых изделий.
              </p>
            </div>
            <div className="static-card">
              <h3>Собственные технологии</h3>
              <p>
                Используем классические и современные методы обработки льна,
                сохраняющие натуральные свойства волокна.
              </p>
            </div>
            <div className="static-card">
              <h3>Экспорт</h3>
              <p>
                Продукция поставляется в Россию, Казахстан, страны ЕС
                и другие регионы.
              </p>
            </div>
            <div className="static-card">
              <h3>Оптовые заказчики</h3>
              <p>
                Более 1 000 оптовых партнёров — от небольших ателье
                до крупных торговых сетей.
              </p>
            </div>
          </div>
        </section>

        <section className="static-section">
          <h2 className="static-section-title">Оптовый портал</h2>
          <p className="static-text">
            Портал создан для удобства оптовых заказчиков: каталог продукции,
            персональные цены, оформление и сопровождение заказов,
            документооборот в одном месте.
          </p>
          <div className="static-actions">
            <Link href="/catalog" className="button dark">
              Перейти в каталог <ArrowRight size={16} />
            </Link>
            <Link href="/register" className="button light" style={{ color: "#292722", borderColor: "#292722" }}>
              Стать оптовым заказчиком
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}