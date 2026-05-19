/**
 * middleware.ts — Middleware global Next.js
 *
 * Responsabilités :
 *   1. Protection des routes via NextAuth (redirige vers /login si non connecté)
 *   2. En-têtes de sécurité HTTP sur toutes les réponses
 *
 * Ce fichier tourne sur l'Edge Runtime → pas de Node.js, pas de Prisma, pas de bcrypt.
 * La logique d'authentification edge-compatible est dans lib/auth.config.ts.
 */
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

// En-têtes de sécurité ajoutés à chaque réponse
const SECURITY_HEADERS: Record<string, string> = {
  // Empêche le chargement dans une iframe (clickjacking)
  "X-Frame-Options": "DENY",
  // Empêche le sniffing de type MIME
  "X-Content-Type-Options": "nosniff",
  // Contrôle les informations de referrer
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Désactive les APIs navigateur non nécessaires
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  // Désactive la résolution DNS préemptive
  "X-DNS-Prefetch-Control": "off",
  // Force HTTPS pendant 1 an (à activer uniquement avec HTTPS)
  // "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export default auth((request: NextRequest & { auth: unknown }) => {
  const response = NextResponse.next();

  // Ajout des en-têtes de sécurité
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
});

// Appliquer le middleware sur toutes les routes sauf les assets statiques
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
