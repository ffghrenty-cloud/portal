'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Header() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((res) => res.json())
      .then((data) => setUser(data.user));
  }, []);

  return (
    <>
      {/* Верхняя чёрная полоска */}
      <div className="bg-black text-white text-[13px] uppercase tracking-widest">
        <div className="max-w-7xl mx-auto px-6 py-2 flex justify-between">
          <span>Оптовые поставки льна от производителя</span>
          <div className="flex gap-6">
            <span>Доставка по СНГ</span>
            <span>+375 (XXX) XX-XX-XX</span>
          </div>
        </div>
      </div>

      {/* Основная шапка */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          {/* Верхний ряд: меню слева, логотип центр, действия справа */}
          <div className="grid grid-cols-3 items-center py-6">
            {/* Меню */}
            <nav className="flex gap-8 text-xs uppercase tracking-widest">
              <Link href="/catalog" className="hover:opacity-60 transition">
                Каталог
              </Link>
              <Link href="/about" className="hover:opacity-60 transition">
                О компании
              </Link>
              <Link href="/contacts" className="hover:opacity-60 transition">
                Контакты
              </Link>
            </nav>

            {/* Логотип по центру */}
            <Link
              href="/"
              className="text-2xl font-black tracking-tight text-center"
            >
              ЛЬНОКОМБИНАТ
            </Link>

            {/* Действия справа */}
            <div className="flex gap-6 justify-end items-center text-xs uppercase tracking-widest">
              {user ? (
                <>
                  <Link
                    href="/profile"
                    className="hover:opacity-60 transition"
                  >
                    Кабинет
                  </Link>
                  <Link
                    href="/cart"
                    className="hover:opacity-60 transition"
                  >
                    Корзина
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:opacity-60 transition">
                    Войти
                  </Link>
                  <Link
                    href="/register"
                    className="hover:opacity-60 transition"
                  >
                    Регистрация
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}