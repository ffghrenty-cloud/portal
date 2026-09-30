"use client";

import { useEffect, useState, useCallback } from "react";

export type FavoriteItem = {
  id: number;
  name: string;
  sku?: string;
  category: string;
  price: number;
  description?: string;
  imageUrl?: string | null;
  unit?: string;
  badge?: string;
  minOrder?: string;
  inStock?: boolean;
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

  useEffect(() => {
    setFavorites(loadFavorites());
    setReady(true);
  }, []);

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
    (id: number | string) =>
      favorites.some((f) => Number(f.id) === Number(id)),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (item: FavoriteItem): "added" | "removed" => {
      const current = loadFavorites();
      const exists = current.some((f) => Number(f.id) === Number(item.id));

      const next = exists
        ? current.filter((f) => Number(f.id) !== Number(item.id))
        : [...current, { ...item, id: Number(item.id) }];

      saveFavorites(next);
      setFavorites(next);
      notify();

      return exists ? "removed" : "added";
    },
    [notify]
  );

  const removeFavorite = useCallback(
    (id: number | string) => {
      const current = loadFavorites();
      const next = current.filter((f) => Number(f.id) !== Number(id));
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