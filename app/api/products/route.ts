import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  return new Promise((resolve) => {
    db.all('SELECT * FROM products', (err, rows) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      } else {
        resolve(NextResponse.json(rows));
      }
    });
  });
}