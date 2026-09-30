"use client";

import Link from "next/link";
import { ArrowRight, Heart, Trash2 } from "lucide-react";
import { useFavorites } from "@/lib/useFavorites";
import { useCart } from "@/lib/useCart";
import { useState } from "react";

export default function FavoritesPage() {
  const { favorites, removeFavorite, clearFavorites } = useFavorites();
  const { add } = useCart();
  const [notice, setNotice] = useState<string | null>(null);

  function showNotice(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(null), 2000);
  }

  function handleAddToCart(item: (typeof favorites)[number]) {
    add(item);
    showNotice(`«${item.name}» добавлен в заявку`);
  }

  function handleRemove(id: number, name: string) {
    removeFavorite(id);
    showNotice(`«${name}» удалён из избранного`);
  }

  return (
    <main className="cart-page">
      <div className="cart-container">
        {/* ЗАГОЛОВОК */}
        <div className="cart-header">
          <div>
            <span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span>
            <h1 className="cart-title">Избранное</h1>
          </div>
          {favorites.length > 0 && (
            <button
              className="cart-clear"
              onClick={() => {
                clearFavorites();
                showNotice("Список избранного очищен");
              }}
            >
              Очистить всё
            </button>
          )}
        </div>

        {/* ПУСТО */}
        {favorites.length === 0 ? (
          <div className="cart-empty">
            <Heart size={48} style={{ color: "#c9c0b5" }} />
            <p style={{ marginTop: 16 }}>
              В избранном пока ничего нет. Добавляйте товары, чтобы вернуться
              к ним позже.
            </p>
            <Link href="/catalog" className="button primary">
              Перейти в каталог <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <>
            <div className="catalog-count">
              {favorites.length}{" "}
              {favorites.length === 1
                ? "товар"
                : favorites.length < 5
                ? "товара"
                : "товаров"}{" "}
              в избранном
            </div>

            {/* СПИСОК */}
            <div className="cart-items">
              {favorites.map((item) => (
                <div className="cart-item" key={item.id}>
                  {/* Картинка */}
                  <div className="cart-item-image">
                    {item.image ? (
                      <img src={item.image} alt={item.name} />
                    ) : (
                      <span className="cart-item-noimg">Нет фото</span>
                    )}
                  </div>

                  {/* Информация */}
                  <div className="cart-item-info">
                    <span className="cart-item-category">{item.category}</span>
                    <h3 className="cart-item-name">{item.name}</h3>
                    <span className="cart-item-sku">
                      Минимальная партия: {item.minOrder}
                    </span>
                    <span
                      className="cart-item-sku"
                      style={{
                        color: item.inStock ? "#5b7a4e" : "#a08a4e",
                        fontWeight: 500,
                        marginTop: 4,
                      }}
                    >
                      {item.inStock ? "В наличии" : "Под заказ"}
                    </span>
                  </div>

                  {/* Цена */}
                  <div className="cart-item-price">
                    <b>{item.price.toFixed(2).replace(".", ",")} BYN</b>
                    <span>за {item.unit}</span>
                  </div>

                  {/* В заявку */}
                  <button
                    className="add-btn"
                    onClick={() => handleAddToCart(item)}
                  >
                    В заявку
                  </button>

                  {/* Удалить */}
                  <button
                    className="cart-item-remove"
                    onClick={() => handleRemove(item.id, item.name)}
                    aria-label="Удалить из избранного"
                    title="Удалить из избранного"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {notice && <div className="toast toast-cart">{notice}</div>}
    </main>
  );
}