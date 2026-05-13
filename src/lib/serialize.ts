/**
 * Convertit récursivement les objets Decimal de Prisma en number.
 * À utiliser dans les Server Components avant de passer des données à un Client Component.
 */
export function serialize<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  // Decimal de Prisma a une méthode toNumber()
  const o = obj as unknown as Record<string, unknown>;
  if (
    typeof obj === "object" &&
    !Array.isArray(obj) &&
    !(obj instanceof Date) &&
    typeof o["toNumber"] === "function"
  ) {
    return (o["toNumber"] as () => number)() as unknown as T;
  }

  if (obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    return obj.map(serialize) as unknown as T;
  }

  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serialize(v)])
    ) as T;
  }

  return obj;
}
