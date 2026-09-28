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
    <header className="bg-blue-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold hover:text-blue-200">
          Оршанский льнокомбинат
        </Link>

        <nav className="flex gap-6 items-center text-white">
          <Link href="/catalog" className="hover:text-blue-200 transition">
            Каталог
          </Link>
          <Link href="/about" className="hover:text-blue-200 transition">
            О компании
          </Link>
          <Link href="/contacts" className="hover:text-blue-200 transition">
            Контакты
          </Link>

          {user ? (
            <Link
              href="/profile"
              className="bg-white text-blue-800 px-4 py-2 rounded font-semibold hover:bg-blue-100 transition"
            >
              Личный кабинет
            </Link>
          ) : (
            <Link
              href="/login"
              className="bg-white text-blue-800 px-4 py-2 rounded font-semibold hover:bg-blue-100 transition"
            >
              Войти
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}