/**
 * Tests unitaires pour src/lib/permissions.ts
 * Vérifie que chaque rôle a les bonnes permissions.
 */
import { describe, it, expect } from "vitest";
import { PERMISSIONS, ROLE_HIERARCHY, canAdmin, canWrite, canValidate } from "@/lib/permissions";

describe("ROLE_HIERARCHY", () => {
  it("ADMIN a le niveau le plus élevé", () => {
    const adminLevel = ROLE_HIERARCHY["ADMIN"];
    for (const [role, level] of Object.entries(ROLE_HIERARCHY)) {
      if (role !== "ADMIN") {
        expect(adminLevel).toBeGreaterThan(level);
      }
    }
  });

  it("LECTURE a le niveau le plus bas", () => {
    const lectureLevel = ROLE_HIERARCHY["LECTURE"];
    for (const level of Object.values(ROLE_HIERARCHY)) {
      expect(lectureLevel).toBeLessThanOrEqual(level);
    }
  });
});

describe("canWrite", () => {
  it("autorise EXPLOITATION et au-dessus", () => {
    expect(canWrite("EXPLOITATION")).toBe(true);
    expect(canWrite("QSE")).toBe(true);
    expect(canWrite("RESPONSABLE_MARCHE")).toBe(true);
    expect(canWrite("DIRECTEUR")).toBe(true);
    expect(canWrite("ADMIN")).toBe(true);
  });

  it("interdit LECTURE", () => {
    expect(canWrite("LECTURE")).toBe(false);
  });
});

describe("canAdmin", () => {
  it("autorise DIRECTEUR et ADMIN", () => {
    expect(canAdmin("DIRECTEUR")).toBe(true);
    expect(canAdmin("ADMIN")).toBe(true);
  });

  it("interdit les rôles en dessous de DIRECTEUR", () => {
    expect(canAdmin("RESPONSABLE_MARCHE")).toBe(false);
    expect(canAdmin("EXPLOITATION")).toBe(false);
    expect(canAdmin("QSE")).toBe(false);
    expect(canAdmin("LECTURE")).toBe(false);
  });
});

describe("PERMISSIONS.markets", () => {
  it("seul ADMIN peut supprimer un marché", () => {
    expect(PERMISSIONS.markets.delete("ADMIN")).toBe(true);
    expect(PERMISSIONS.markets.delete("DIRECTEUR")).toBe(false);
    expect(PERMISSIONS.markets.delete("RESPONSABLE_MARCHE")).toBe(false);
  });

  it("RESPONSABLE_MARCHE peut créer et modifier", () => {
    expect(PERMISSIONS.markets.create("RESPONSABLE_MARCHE")).toBe(true);
    expect(PERMISSIONS.markets.edit("RESPONSABLE_MARCHE")).toBe(true);
  });

  it("LECTURE ne peut rien modifier", () => {
    expect(PERMISSIONS.markets.create("LECTURE")).toBe(false);
    expect(PERMISSIONS.markets.edit("LECTURE")).toBe(false);
    expect(PERMISSIONS.markets.delete("LECTURE")).toBe(false);
    expect(PERMISSIONS.markets.archive("LECTURE")).toBe(false);
  });
});

describe("PERMISSIONS.analysis", () => {
  it("RESPONSABLE_MARCHE peut lancer et valider l'analyse", () => {
    expect(PERMISSIONS.analysis.run("RESPONSABLE_MARCHE")).toBe(true);
    expect(PERMISSIONS.analysis.validate("RESPONSABLE_MARCHE")).toBe(true);
  });

  it("EXPLOITATION ne peut pas lancer d'analyse", () => {
    expect(PERMISSIONS.analysis.run("EXPLOITATION")).toBe(false);
  });
});

describe("PERMISSIONS.settings", () => {
  it("seuls DIRECTEUR et ADMIN gèrent les paramètres", () => {
    expect(PERMISSIONS.settings.manage("ADMIN")).toBe(true);
    expect(PERMISSIONS.settings.manage("DIRECTEUR")).toBe(true);
    expect(PERMISSIONS.settings.manage("RESPONSABLE_MARCHE")).toBe(false);
  });
});
