import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";

const PUBLIC_AUTH_PATHS = new Set(["/api/login", "/api/register", "/api/logout"]);

export async function proxy(request: NextRequest) {
  if (PUBLIC_AUTH_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const userId = request.cookies.get("userId")?.value;
  if (!userId) return NextResponse.next();

  const sessionToken = request.cookies.get("session")?.value;
  const isValid = sessionToken ? await verifySessionToken(sessionToken, userId) : false;
  if (isValid) return NextResponse.next();

  // Старые или поддельные userId-cookie не должны давать доступ к API.
  request.cookies.delete("userId");
  request.cookies.delete("userRole");
  request.cookies.delete("session");

  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.delete("userId");
  response.cookies.delete("userRole");
  response.cookies.delete("session");
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
