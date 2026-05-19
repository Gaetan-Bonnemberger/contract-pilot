/**
 * GET /api/health
 *
 * Endpoint de santé utilisé par :
 *   - Docker healthcheck
 *   - Monitoring interne (Uptime Kuma, etc.)
 *   - Vérification rapide avant déploiement
 *
 * Retourne 200 si l'application ET la base de données sont opérationnelles.
 * Retourne 503 si la base est injoignable.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic"; // Pas de cache sur le health check

export async function GET() {
  const start = Date.now();

  try {
    // Ping la base de données avec un SELECT 1 minimal
    await prisma.$queryRaw`SELECT 1`;

    const latencyMs = Date.now() - start;

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version ?? "unknown",
        database: { status: "ok", latencyMs },
        uptime: Math.floor(process.uptime()),
      },
      { status: 200 }
    );
  } catch (error) {
    const latencyMs = Date.now() - start;
    console.error("[health] Erreur base de données :", error);

    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        database: {
          status: "unreachable",
          latencyMs,
          error: error instanceof Error ? error.message : "Erreur inconnue",
        },
      },
      { status: 503 }
    );
  }
}
