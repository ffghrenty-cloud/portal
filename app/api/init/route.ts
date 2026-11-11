import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/schema';
import { seedProducts } from '@/lib/seed';

export async function GET() {
  // Vercel Preview and Production both run with NODE_ENV=production.
  // Database initialization is handled by instrumentation.ts at runtime;
  // this manual endpoint must never mutate a deployed database.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await initDatabase();
    await seedProducts();
    return NextResponse.json({ ok: true, message: 'База инициализирована' });
  } catch (err: any) {
    console.error('Ошибка локальной инициализации базы:', err);
    return NextResponse.json({ ok: false, error: 'Не удалось инициализировать базу' }, { status: 500 });
  }
}
