/**
 * /api/users/:userId/reset-password — Réinitialisation du mot de passe par un admin
 * L'admin définit directement le nouveau mot de passe (pas d'email de reset).
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIp, RESET_PASSWORD_RATE_LIMIT } from "@/lib/rate-limit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  // Rate limiting : 5 resets par heure par IP
  const { success: allowed, resetInSeconds } = checkRateLimit(
    getClientIp(req),
    RESET_PASSWORD_RATE_LIMIT
  );
  if (!allowed) {
    return NextResponse.json(
      { error: `Trop de tentatives. Réessayez dans ${Math.ceil(resetInSeconds / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(resetInSeconds) } }
    );
  }

  const { userId } = await params;
  const { password } = await req.json();

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Le mot de passe doit faire au moins 8 caractères" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
