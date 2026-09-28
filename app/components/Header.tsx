'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-blue-700">
          Оршанский льнокомбинат
        </Link>

        <nav className="flex gap-6 items-center">
          <Link href="/catalog" className="hover:text-blue-600">
            Каталог
          </Link>
          <Link href="/about" className="hover:text-blue-600">
            О компании
          </Link>
          <Link href="/contacts" className="hover:text-blue-600">
            Контакты
          </Link>
          <Link
            href="/login"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Войти
          </Link>
        </nav>
      </div>
    </header>
  );
}