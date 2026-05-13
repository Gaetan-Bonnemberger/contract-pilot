import type { UserRole } from "@prisma/client";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  ADMIN: 100,
  DIRECTEUR: 80,
  RESPONSABLE_MARCHE: 60,
  EXPLOITATION: 40,
  QSE: 40,
  LECTURE: 10,
};

export function canWrite(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= 40;
}

export function canAdmin(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= 80;
}

export function canValidate(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= 60;
}

export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN";
}

// Permissions par fonctionnalité
export const PERMISSIONS = {
  markets: {
    create: (role: UserRole) => ROLE_HIERARCHY[role] >= 60,
    edit: (role: UserRole) => ROLE_HIERARCHY[role] >= 60,
    delete: (role: UserRole) => role === "ADMIN",
    archive: (role: UserRole) => ROLE_HIERARCHY[role] >= 80,
  },
  analysis: {
    run: (role: UserRole) => ROLE_HIERARCHY[role] >= 60,
    validate: (role: UserRole) => ROLE_HIERARCHY[role] >= 60,
  },
  projects: {
    create: (role: UserRole) => ROLE_HIERARCHY[role] >= 40,
    edit: (role: UserRole) => ROLE_HIERARCHY[role] >= 40,
    delete: (role: UserRole) => ROLE_HIERARCHY[role] >= 60,
  },
  alerts: {
    close: (role: UserRole) => ROLE_HIERARCHY[role] >= 40,
    recalculate: (role: UserRole) => ROLE_HIERARCHY[role] >= 60,
  },
  actions: {
    create: (role: UserRole) => ROLE_HIERARCHY[role] >= 40,
    edit: (role: UserRole) => ROLE_HIERARCHY[role] >= 40,
  },
  settings: {
    manage: (role: UserRole) => ROLE_HIERARCHY[role] >= 80,
  },
} as const;
