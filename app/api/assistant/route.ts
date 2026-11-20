import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Assistant } from "@/lib/Assistant";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = body?.question;

    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Не указан вопрос" }, { status: 400 });
    }

    if (question.length > 2000) {
      return NextResponse.json({ error: "Сообщение слишком длинное" }, { status: 400 });
    }

    const history = Array.isArray(body?.history)
      ? body.history
          .filter(
            (item: any) =>
              item &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string"
          )
          .slice(-10)
          .map((item: any) => ({
            role: item.role as "user" | "assistant",
            content: item.content.slice(0, 2000),
          }))
      : [];

    const cookieStore = await cookies();
    const userIdRaw = cookieStore.get("userId")?.value;
    const parsedUserId = userIdRaw ? Number.parseInt(userIdRaw, 10) : Number.NaN;
    const userId = Number.isSafeInteger(parsedUserId) && parsedUserId > 0 ? parsedUserId : null;

    const assistant = new Assistant(userId);
    const response = await assistant.ask(question.trim(), history);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Assistant route error:", error);
    return NextResponse.json(
      { error: "Не удалось обработать сообщение. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}
