import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Assistant } from "@/lib/Assistant";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Не указан вопрос" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const userIdRaw = cookieStore.get("userId")?.value;
    const userId = userIdRaw ? parseInt(userIdRaw, 10) : null;

    const assistant = new Assistant(userId);
    const response = await assistant.ask(question);

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}