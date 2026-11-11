import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { notificationService } from "@/lib/notifications/notification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedUserId(): Promise<number | null> {
  const value = (await cookies()).get("userId")?.value;
  if (!value) return null;
  const userId = Number(value);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Не авторизован" }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const result = await notificationService.listForUser(userId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Ошибка загрузки уведомлений:", error);
    return NextResponse.json({ error: "Не удалось загрузить уведомления" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  let body: { id?: unknown; all?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  try {
    if (body.all === true) {
      const updated = await notificationService.markAllAsRead(userId);
      return NextResponse.json({ ok: true, updated });
    }

    const id = Number(body.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Укажите корректное уведомление" }, { status: 400 });
    }

    const updated = await notificationService.markAsRead(userId, id);
    if (!updated) {
      return NextResponse.json({ error: "Уведомление не найдено или уже прочитано" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Ошибка изменения уведомления:", error);
    return NextResponse.json({ error: "Не удалось обновить уведомления" }, { status: 500 });
  }
}
