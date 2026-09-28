import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/schema';
import { seedProducts } from '@/lib/seed';

export async function GET() {
  try {
    await initDatabase();
    await seedProducts();
    return NextResponse.json({ ok: true, message: 'База инициализирована' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}