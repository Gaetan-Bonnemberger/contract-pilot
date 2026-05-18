/**
 * /api/users/:userId — Modification et suppression d'un compte
 * Réservé aux ADMIN. Un admin ne peut pas se supprimer lui-même.
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

const VALID_ROLES: UserRole[] = [
  "ADMIN", "DIRECTEUR", "RESPONSABLE_MARCHE", "EXPLOITATION", "QSE", "LECTURE",
];

// ── PATCH /api/users/:userId — Modifier un utilisateur ────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await req.json();

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Validation du rôle si fourni
  if (body.role && !VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }

  // Un admin ne peut pas se désactiver lui-même
  if (userId === session.user.id && body.isActive === false) {
    return NextResponse.json({ error: "Vous ne pouvez pas désactiver votre propre compte" }, { status: 400 });
  }

  // Un admin ne peut pas changer son propre rôle
  if (userId === session.user.id && body.role && body.role !== "ADMIN") {
    return NextResponse.json({ error: "Vous ne pouvez pas modifier votre propre rôle" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName:  body.firstName?.trim()            ?? existing.firstName,
      lastName:   body.lastName?.trim()             ?? existing.lastName,
      email:      body.email?.toLowerCase().trim()  ?? existing.email,
      role:       body.role                         ?? existing.role,
      isActive:   body.isActive !== undefined ? body.isActive : existing.isActive,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { responsibleMarkets: true } },
    },
  });

  return NextResponse.json(updated);
}

// ── DELETE /api/users/:userId — Supprimer un utilisateur ──────────────────
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  const { userId } = await params;

  // Un admin ne peut pas se supprimer lui-même
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { _count: { select: { responsibleMarkets: true, auditLogs: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Si l'utilisateur est responsable de marchés, on désactive plutôt que supprimer
  if (existing._count.responsibleMarkets > 0) {
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    return NextResponse.json({
      ok: true,
      action: "deactivated",
      reason: `L'utilisateur est responsable de ${existing._count.responsibleMarkets} marché(s) — compte désactivé plutôt que supprimé`,
    });
  }

  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ ok: true, action: "deleted" });
}
