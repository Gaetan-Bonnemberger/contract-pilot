import type { NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";

// Config edge-compatible (sans bcryptjs ni Prisma)
// Utilisée par le middleware qui tourne dans l'Edge Runtime
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }: { auth: Session | null; request: NextRequest }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = request.nextUrl.pathname === "/login";

      if (!isLoggedIn && !isLoginPage) {
        return Response.redirect(new URL("/login", request.nextUrl));
      }
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
    async jwt({ token, user }: { token: JWT; user?: { id?: string; role?: UserRole } }) {
      if (user) {
        if (user.role !== undefined) token.role = user.role;
        if (user.id !== undefined) token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
  providers: [], // Les providers (Credentials + bcryptjs) sont dans auth.ts
};
