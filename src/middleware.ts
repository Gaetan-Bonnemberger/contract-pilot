import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Le middleware utilise uniquement la config edge-compatible
// (sans bcryptjs ni Prisma — pas de Node.js crypto)
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
