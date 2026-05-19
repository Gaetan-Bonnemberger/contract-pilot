/**
 * Tests unitaires pour src/lib/rate-limit.ts
 */
import { describe, it, expect } from "vitest";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { RateLimitConfig } from "@/lib/rate-limit";

const TEST_RULE: RateLimitConfig = {
  key: "test-rule",
  limit: 3,
  windowSeconds: 60,
};

describe("checkRateLimit", () => {
  it("autorise les premières requêtes jusqu'à la limite", () => {
    const ip = `test-ip-${Date.now()}-a`; // IP unique par test

    const r1 = checkRateLimit(ip, TEST_RULE);
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(ip, TEST_RULE);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(ip, TEST_RULE);
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("bloque les requêtes au-delà de la limite", () => {
    const ip = `test-ip-${Date.now()}-b`;

    checkRateLimit(ip, TEST_RULE); // 1
    checkRateLimit(ip, TEST_RULE); // 2
    checkRateLimit(ip, TEST_RULE); // 3 — dernier autorisé

    const blocked = checkRateLimit(ip, TEST_RULE); // 4 — bloqué
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("isole les IPs différentes", () => {
    const ip1 = `ip-isolated-${Date.now()}-1`;
    const ip2 = `ip-isolated-${Date.now()}-2`;

    checkRateLimit(ip1, TEST_RULE);
    checkRateLimit(ip1, TEST_RULE);
    checkRateLimit(ip1, TEST_RULE);
    const blockedIp1 = checkRateLimit(ip1, TEST_RULE);
    expect(blockedIp1.success).toBe(false);

    // ip2 n'est pas affectée
    const okIp2 = checkRateLimit(ip2, TEST_RULE);
    expect(okIp2.success).toBe(true);
  });

  it("isole les règles différentes", () => {
    const ip = `test-ip-${Date.now()}-rules`;
    const ruleA: RateLimitConfig = { key: "rule-a", limit: 1, windowSeconds: 60 };
    const ruleB: RateLimitConfig = { key: "rule-b", limit: 5, windowSeconds: 60 };

    checkRateLimit(ip, ruleA); // épuise ruleA
    const blockedA = checkRateLimit(ip, ruleA);
    expect(blockedA.success).toBe(false);

    const okB = checkRateLimit(ip, ruleB); // ruleB indépendante
    expect(okB.success).toBe(true);
  });

  it("fournit un resetInSeconds cohérent", () => {
    const ip = `test-ip-${Date.now()}-reset`;
    const result = checkRateLimit(ip, TEST_RULE);
    expect(result.resetInSeconds).toBeGreaterThan(0);
    expect(result.resetInSeconds).toBeLessThanOrEqual(TEST_RULE.windowSeconds);
  });
});

describe("getClientIp", () => {
  it("lit l'IP depuis x-forwarded-for", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "192.168.1.42, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("192.168.1.42");
  });

  it("lit l'IP depuis x-real-ip en second recours", () => {
    const req = new Request("http://localhost/api/test", {
      headers: { "x-real-ip": "10.10.10.10" },
    });
    expect(getClientIp(req)).toBe("10.10.10.10");
  });

  it("retourne 'unknown' si aucun header IP", () => {
    const req = new Request("http://localhost/api/test");
    expect(getClientIp(req)).toBe("unknown");
  });
});
