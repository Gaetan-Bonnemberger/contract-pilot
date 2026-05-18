import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { AuditAction } from "@prisma/client";

export interface AuditEntry {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  marketId?: string;
  label: string;
  details?: Record<string, unknown>;
}

/**
 * Enregistre une entrée dans le journal d'audit.
 * Ne bloque jamais l'action principale — les erreurs sont avalées silencieusement.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        marketId: entry.marketId ?? null,
        label: entry.label,
        details: entry.details !== undefined
          ? (entry.details as Prisma.InputJsonObject)
          : Prisma.JsonNull,
      },
    });
  } catch (err) {
    // Le journal ne doit jamais bloquer l'action principale
    console.error("[audit] Échec enregistrement :", err);
  }
}
