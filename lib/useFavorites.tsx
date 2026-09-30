"use client";

import { useEffect, useState, useCallback } from "react";

export type FavoriteItem = {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  image: string;
  minOrder: string;
  inStock: boolean;
};

const STORAGE_KEY = "favorites";
const FAVORITES_EVENT = "favorites-changed";

function loadFavorites(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FavoriteItem[]) : [];
  } catch {
    return [];
  }
}

function saveFavorites(items: FavoriteItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [ready, setReady] = useState(false);

  // Загрузка при монтировании
  useEffect(() => {
    setFavorites(loadFavorites());
    setReady(true);
  }, []);

  // Подписка на изменения (в т.ч. из других вкладок и компонентов)
  useEffect(() => {
    const handler = () => setFavorites(loadFavorites());
    window.addEventListener(FAVORITES_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const notify = useCallback(() => {
    window.dispatchEvent(new Event(FAVORITES_EVENT));
  }, []);

  const isFavorite = useCallback(
    (id: number) => favorites.some((f) => f.id === id),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (item: FavoriteItem) => {
      const current = loadFavorites();
      const exists = current.some((f) => f.id === item.id);
      const next = exists
        ? current.filter((f) => f.id !== item.id)
        : [...current, item];
      saveFavorites(next);
      setFavorites(next);
      notify();
    },
    [notify]
  );

  const removeFavorite = useCallback(
    (id: number) => {
      const current = loadFavorites();
      const next = current.filter((f) => f.id !== id);
      saveFavorites(next);
      setFavorites(next);
      notify();
    },
    [notify]
  );

  const clearFavorites = useCallback(() => {
    saveFavorites([]);
    setFavorites([]);
    notify();
  }, [notify]);

  return {
    ready,
    favorites,
    count: favorites.length,
    isEmpty: favorites.length === 0,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    clearFavorites,
  };
}