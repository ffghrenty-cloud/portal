import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  return new Promise((resolve) => {
    db.get('SELECT 1 as ok', (err, row) => {
      if (err) {
        resolve(NextResponse.json({ works: false, error: err.message }));
      } else {
        resolve(NextResponse.json({ works: true, result: row }));
      }
    });
  });
}