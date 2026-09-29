"use client";

import Link from "next/link";
import { ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/lib/useCart";

export default function CartPage() {
  const { ready, items, count, formattedTotal, isEmpty, remove, setQuantity, clear } =
    useCart();

  if (!ready) {
    return (
      <div className="cart-page">
        <div className="cart-container">
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-container">
        <div className="cart-header">
          <div>
            <span className="eyebrow">КОРЗИНА</span>
            <h1 className="cart-title">Заявка на продукцию</h1>
          </div>
          <Link href="/catalog" className="text-link">
            Продолжить покупки <ArrowRight size={16} />
          </Link>
        </div>

        {isEmpty ? (
          <div className="cart-empty">
            <p>В корзине пока нет товаров.</p>
            <Link href="/catalog" className="button dark">
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            {/* Левая часть — список товаров */}
            <div className="cart-items">
              {items.map((item) => (
                <div className="cart-item" key={item.productId}>
                  <div className="cart-item-image">
                    {item.hasImage ? (
                      <img src={item.imageUrl!} alt={item.name} />
                    ) : (
                      <div className="cart-item-noimg">Нет фото</div>
                    )}
                  </div>

                  <div className="cart-item-info">
                    <span className="cart-item-category">{item.category}</span>
                    <h3 className="cart-item-name">{item.name}</h3>
                    <span className="cart-item-sku">Артикул: {item.sku}</span>
                  </div>

                  <div className="cart-item-qty">
                    <button
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      aria-label="Уменьшить"
                    >
                      <Minus size={14} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      aria-label="Увеличить"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="cart-item-price">
                    <b>{item.formattedSubtotal}</b>
                    <span>{item.formattedPrice} / ед.</span>
                  </div>

                  <button
                    className="cart-item-remove"
                    onClick={() => remove(item.productId)}
                    aria-label="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Правая часть — итог */}
            <aside className="cart-summary">
              <h2 className="cart-summary-title">Итого</h2>

              <div className="cart-summary-row">
                <span>Позиций</span>
                <span>{items.length}</span>
              </div>
              <div className="cart-summary-row">
                <span>Единиц товара</span>
                <span>{count}</span>
              </div>

              <div className="cart-summary-total">
                <span>Сумма</span>
                <b>{formattedTotal}</b>
              </div>

              <p className="cart-summary-note">
                Стоимость может быть уточнена менеджером с учётом объёма
                и условий поставки.
              </p>

              <Link href="/checkout" className="button dark cart-checkout">
                Оформить заявку
              </Link>

              <button
                onClick={clear}
                className="cart-clear"
                type="button"
              >
                Очистить корзину
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}