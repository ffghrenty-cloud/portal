"use client";

import { useEffect, useState, useCallback } from "react";
import { Cart, CartItem } from "./Cart";
import { Product } from "./Product";

const CART_EVENT = "cart-changed";

export function useCart() {
  const [cart, setCart] = useState<Cart>(() => new Cart());
  const [ready, setReady] = useState(false);

  // Загрузка из localStorage при монтировании
  useEffect(() => {
    setCart(Cart.load());
    setReady(true);
  }, []);

  // Подписка на внешние изменения (например, из другой вкладки или другого компонента)
  useEffect(() => {
    const handler = () => setCart(Cart.load());
    window.addEventListener(CART_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CART_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  // Публикуем изменения наружу
  const notify = useCallback(() => {
    window.dispatchEvent(new Event(CART_EVENT));
  }, []);

  const add = useCallback(
    (product: Product, quantity = 1) => {
      const c = Cart.load();
      c.add(product, quantity);
      setCart(c);
      notify();
    },
    [notify]
  );

  const remove = useCallback(
    (productId: number) => {
      const c = Cart.load();
      c.remove(productId);
      setCart(c);
      notify();
    },
    [notify]
  );

  const setQuantity = useCallback(
    (productId: number, quantity: number) => {
      const c = Cart.load();
      c.setQuantity(productId, quantity);
      setCart(c);
      notify();
    },
    [notify]
  );

  const clear = useCallback(() => {
    const c = Cart.load();
    c.clear();
    setCart(c);
    notify();
  }, [notify]);

  return {
    ready,
    items: cart.getItems(),
    count: cart.getCount(),
    total: cart.getTotal(),
    formattedTotal: cart.getFormattedTotal(),
    isEmpty: cart.isEmpty(),
    add,
    remove,
    setQuantity,
    clear,
  };
}