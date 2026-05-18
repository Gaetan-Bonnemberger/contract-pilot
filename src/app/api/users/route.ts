/**
 * /api/users — Gestion des comptes utilisateurs
 * Réservé aux ADMIN uniquement.
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";

const VALID_ROLES: UserRole[] = [
  "ADMIN", "DIRECTEUR", "RESPONSABLE_MARCHE", "EXPLOITATION", "QSE", "LECTURE",
];

// ── GET /api/users — Liste tous les utilisateurs ───────────────────────────
export async function GET(_req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      // Nombre de marchés dont l'utilisateur est responsable
      _count: { select: { responsibleMarkets: true } },
    },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { lastName: "asc" }],
  });

  return NextResponse.json(users);
}

// ── POST /api/users — Créer un utilisateur ────────────────────────────────
export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  const body = await req.json();
  const { firstName, lastName, email, role, password } = body;

  // Validation des champs obligatoires
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !role || !password) {
    return NextResponse.json({ error: "Tous les champs sont requis" }, { status: 400 });
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit faire au moins 8 caractères" }, { status: 400 });
  }

  // Vérifier que l'email n'est pas déjà utilisé
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      role,
      passwordHash,
      isActive: true,
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

  return NextResponse.json(user, { status: 201 });
}
