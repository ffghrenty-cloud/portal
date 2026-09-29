"use client";

import { useCart } from "@/lib/useCart";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Heart, Package, Truck } from "lucide-react";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  image: string;
  badge?: string;
  minOrder: string;
  inStock: boolean;
};

const products: Product[] = [
  {
    id: 1,
    name: "Льняная ткань «Классик»",
    category: "Ткани",
    price: 12.8,
    unit: "м",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=85",
    badge: "Хит",
    minOrder: "от 50 м",
    inStock: true,
  },
  {
    id: 2,
    name: "Льняная ткань костюмная",
    category: "Ткани",
    price: 18.4,
    unit: "м",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85",
    minOrder: "от 30 м",
    inStock: true,
  },
  {
    id: 3,
    name: "Пряжа льняная №40",
    category: "Пряжа",
    price: 9.7,
    unit: "кг",
    image:
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=85",
    badge: "Новинка",
    minOrder: "от 10 кг",
    inStock: true,
  },
  {
    id: 4,
    name: "Льняное полотно отбеленное",
    category: "Ткани",
    price: 15.2,
    unit: "м",
    image:
      "https://images.unsplash.com/photo-1583743814966-8936f37f384f?auto=format&fit=crop&w=900&q=85",
    minOrder: "от 50 м",
    inStock: false,
  },
  {
    id: 5,
    name: "Столовый текстиль",
    category: "Домашний текстиль",
    price: 21.5,
    unit: "компл.",
    image:
      "https://images.unsplash.com/photo-1583845112203-454c7b7e1b66?auto=format&fit=crop&w=900&q=85",
    badge: "Опт",
    minOrder: "от 20 компл.",
    inStock: true,
  },
];

const categories = [
  { title: "Льняные ткани", sub: "Рулонные материалы", icon: "01", filter: "Ткани" },
  { title: "Пряжа", sub: "Натуральное сырьё", icon: "02", filter: "Пряжа" },
  { title: "Домашний текстиль", sub: "Готовые изделия", icon: "03", filter: "Домашний текстиль" },
  { title: "Готовая продукция", sub: "Для корпоративных заказов", icon: "04", filter: "Все" },
  { title: "Спецзаказы", sub: "Индивидуальные условия", icon: "05", filter: "Все" },
];

export default function Home() {
  const [category, setCategory] = useState("Все");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const byCategory = category === "Все" || p.category === category;
      const bySearch = p.name.toLowerCase().includes(search.toLowerCase());
      return byCategory && bySearch;
    });
  }, [category, search]);

  function addToCart() {
    setNotice("Товар добавлен в заявку");
    setTimeout(() => setNotice(""), 1800);
  }

  function showNotice(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(""), 1800);
  }

  return (
    <main>
      {/* HERO */}
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow">ОПТОВЫЙ ПОРТАЛ ПРЕДПРИЯТИЯ</div>
          <h1>
            Оптовые поставки
            <br />
            <em>льняной продукции</em>
          </h1>
          <p>
            Каталог продукции, персональные цены и сопровождение заказов
            в одном портале.
          </p>
          <div className="hero-buttons">
            <Link href="/catalog" className="button primary">
              Перейти в каталог <ArrowRight size={18} />
            </Link>
            <Link href="/register" className="button light">
              Создать заявку
            </Link>
          </div>
        </div>
        <div className="hero-note">
          <span>НАДЁЖНЫЕ ПОСТАВКИ</span>
          <b>с 1930 года</b>
        </div>
      </section>

      {/* СТАТИСТИКА */}
      <section className="stats">
        <div>
          <b>90+</b>
          <span>лет производства</span>
        </div>
        <div>
          <b>30+</b>
          <span>видов продукции</span>
        </div>
        <div>
          <b>1 000+</b>
          <span>оптовых заказчиков</span>
        </div>
        <div>
          <b>24/7</b>
          <span>отслеживание заказов</span>
        </div>
      </section>

      {/* КАТЕГОРИИ */}
      <section className="section" id="catalog">
        <div className="section-head">
          <div>
            <span className="eyebrow">КАТЕГОРИИ</span>
            <h2>Продукция для оптовых заказчиков</h2>
          </div>
          <Link href="/catalog" className="text-link">
            Весь каталог <ArrowRight size={16} />
          </Link>
        </div>

        <div className="categories">
          {categories.map((item) => (
            <button
              key={item.title}
              className="category-card"
              onClick={() => {
                setCategory(item.filter);
                document
                  .getElementById("products")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <span className="category-number">{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.sub}</p>
              </div>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
      </section>

      {/* ОПТОВЫЕ УСЛОВИЯ */}
      <section className="banner" id="prices">
        <div>
          <span className="eyebrow">ОПТОВЫЕ УСЛОВИЯ</span>
          <h2>
            Персональные цены
            <br />
            для постоянных заказчиков
          </h2>
          <p>
            Стоимость рассчитывается с учётом объёма, условий поставки
            и истории сотрудничества.
          </p>
          <button
            className="button dark"
            onClick={() => showNotice("Запрос на персональные цены подготовлен")}
          >
            Запросить условия <ArrowRight size={17} />
          </button>
        </div>
        <div className="banner-mark">Л</div>
      </section>

      {/* ТОВАРЫ */}
      <section className="section products-section" id="products">
        <div className="section-head">
          <div>
            <span className="eyebrow">КАТАЛОГ</span>
            <h2>Популярная продукция</h2>
          </div>
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder="Поиск продукции..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "10px 16px",
                border: "1px solid #d9d2ca",
                fontSize: "14px",
                fontFamily: "inherit",
                background: "#fbf9f6",
                minWidth: "220px",
                outline: "none",
              }}
            />
            <div className="filter-row">
              {["Все", "Ткани", "Пряжа", "Домашний текстиль"].map((item) => (
                <button
                  key={item}
                  className={
                    category === item ? "filter active-filter" : "filter"
                  }
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="products-grid">
          {filteredProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="product-image">
                <img src={product.image} alt={product.name} />
                {product.badge && (
                  <span className="badge">{product.badge}</span>
                )}
                <button className="heart" aria-label="В избранное">
                  <Heart size={17} />
                </button>
              </div>
              <div className="product-info">
                <span className="product-category">{product.category}</span>
                <h3>{product.name}</h3>
                <div className="product-stock">
                  {product.inStock ? "В наличии" : "Под заказ"}
                </div>
                <div className="product-bottom">
                  <div className="product-price">
                    <b>{product.price.toFixed(2).replace(".", ",")} BYN</b>
                    <span>за {product.unit}</span>
                  </div>
                  <button className="add-btn" onClick={addToCart}>
                    В заявку
                  </button>
                </div>
                <small>Минимальная партия: {product.minOrder}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ПРОЦЕСС РАБОТЫ */}
      <section className="workflow" id="orders">
        <div className="section-head">
          <div>
            <span className="eyebrow">РАБОТА С ЗАКАЗОМ</span>
            <h2>От заявки до поставки — прозрачно</h2>
          </div>
        </div>
        <div className="steps">
          <div className="step">
            <span>01</span>
            <Package />
            <h3>Формирование заявки</h3>
            <p>Выберите продукцию и укажите нужный объём.</p>
          </div>
          <div className="step">
            <span>02</span>
            <FileText />
            <h3>Согласование</h3>
            <p>Менеджер подтверждает цену, количество и сроки.</p>
          </div>
          <div className="step">
            <span>03</span>
            <Truck />
            <h3>Поставка</h3>
            <p>Отслеживайте статус заказа и документы онлайн.</p>
          </div>
        </div>
      </section>

      {/* ДОКУМЕНТЫ */}
      <section className="documents" id="documents">
        <div className="document-copy">
          <span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span>
          <h2>
            Все документы
            <br />
            в одном месте
          </h2>
          <p>
            Счета, спецификации, договоры и сопроводительные документы
            доступны заказчику без лишней переписки.
          </p>
          <Link href="/documents" className="button primary">
            Открыть документы <ArrowRight size={17} />
          </Link>
        </div>
        <div className="document-list">
          {[
            "Счета на оплату",
            "Спецификации заказа",
            "Договоры и приложения",
            "Отгрузочные документы",
          ].map((x, i) => (
            <div className="doc-row" key={x}>
              <span>0{i + 1}</span>
              <strong>{x}</strong>
              <ArrowRight size={18} />
            </div>
          ))}
        </div>
      </section>

      {/* О ПРЕДПРИЯТИИ */}
      <section className="company" id="company">
        <div>
          <span className="eyebrow">РУПТП «ОРШАНСКИЙ ЛЬНОКОМБИНАТ»</span>
          <h2>
            Натуральный материал.
            <br />
            Современный сервис.
          </h2>
        </div>
        <p>
          Портал объединяет каталог продукции, оптовое ценообразование,
          оформление и сопровождение заказов, согласование и документооборот
          с заказчиками.
        </p>
      </section>

      {/* ПОДВАЛ */}
      <footer>
        <div className="footer-brand">ОРШАЛЁН</div>
        <div className="footer-links">
          <Link href="/catalog">Каталог</Link>
          <Link href="/orders">Заказы</Link>
          <Link href="/prices">Цены</Link>
          <Link href="/documents">Документы</Link>
        </div>
        <div className="footer-contact">
          Отдел оптовых продаж
          <br />
          <b>+375 (216) 00-00-00</b>
        </div>
      </footer>

      {notice && <div className="toast">{notice}</div>}
    </main>
  );
}