'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
        else router.push('/login');
      });
  }, [router]);

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  if (!user) return <div className="p-8">Загрузка...</div>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-8 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Личный кабинет</h1>

      <div className="space-y-3 mb-8">
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Роль:</strong> {user.role}</p>
        {user.company && <p><strong>Компания:</strong> {user.company}</p>}
      </div>

      <button
        onClick={handleLogout}
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
      >
        Выйти
      </button>
    </div>
  );
}