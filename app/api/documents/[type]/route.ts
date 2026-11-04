import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  return NextResponse.json(
    {
      error: "Укажите номер заказа для формирования документа",
      example: `/api/documents/${encodeURIComponent(type)}/123`,
    },
    { status: 400 }
  );
}
