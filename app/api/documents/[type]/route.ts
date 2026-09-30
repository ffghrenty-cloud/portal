import { cookies } from "next/headers";
import db from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string; orderId: string }> }
) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  const userRole = cookieStore.get("userRole")?.value;
  const { type, orderId } = await params;

  if (!userId) {
    return new Response("Не авторизован", { status: 401 });
  }

  // Проверяем: либо админ, либо владелец заказа
  const isAdmin = userRole === "admin";

  const order: any = await new Promise((resolve, reject) => {
    if (isAdmin) {
      db.get(
        "SELECT * FROM orders WHERE id = ?",
        [orderId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    } else {
      db.get(
        "SELECT * FROM orders WHERE id = ? AND user_id = ?",
        [orderId, userId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    }
  });

  if (!order) {
    return new Response("Заказ не найден", { status: 404 });
  }
  // ... генерация PDF
}