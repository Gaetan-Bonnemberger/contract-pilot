/**
 * rate-limit.ts — Rate limiter in-memory (sans Redis)
 *
 * Adapté pour une application interne avec ~50 utilisateurs simultanés.
 * Utilise une fenêtre glissante par IP. Les compteurs sont en mémoire :
 * ils se remettent à zéro à chaque redémarrage du serveur, ce qui est
 * acceptable pour un usage interne.
 *
 * Pour un usage à plus grande échelle, migrer vers @upstash/ratelimit + Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp ms
}

// Map globale — persiste entre les requêtes (Node.js runtime uniquement)
const store = new Map<string, RateLimitEntry>();

// Nettoyage automatique toutes les 5 minutes pour éviter les fuites mémoire
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  success: boolean;       // true = requête autorisée
  remaining: number;      // tentatives restantes
  resetInSeconds: number; // secondes avant reset
}

export interface RateLimitConfig {
  /** Identifiant de la règle (ex: "login", "reset-password") */
  key: string;
  /** Nombre maximal de requêtes dans la fenêtre */
  limit: number;
  /** Durée de la fenêtre en secondes */
  windowSeconds: number;
}

/**
 * Vérifie si une IP dépasse la limite pour une règle donnée.
 * @param ip  Adresse IP du client (depuis les headers)
 * @param config  Règle de limite
 */
export function checkRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  const storeKey = `${config.key}:${ip}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const entry = store.get(storeKey);

  // Fenêtre expirée ou première requête
  if (!entry || entry.resetAt < now) {
    store.set(storeKey, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: config.limit - 1, resetInSeconds: config.windowSeconds };
  }

  // Fenêtre active — incrémenter
  entry.count++;
  const remaining = Math.max(0, config.limit - entry.count);
  const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);

  if (entry.count > config.limit) {
    return { success: false, remaining: 0, resetInSeconds };
  }

  return { success: true, remaining, resetInSeconds };
}

/**
 * Extrait l'IP réelle depuis les headers de la requête.
 * Tient compte des proxys (X-Forwarded-For, CF-Connecting-IP…)
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("cf-connecting-ip") ??        // Cloudflare
    headers.get("x-real-ip") ??               // Nginx proxy
    headers.get("x-forwarded-for")?.split(",")[0].trim() ?? // Load balancer
    "unknown"
  );
}

// ── Règles prédéfinies ────────────────────────────────────────────────────────

/** Login : 10 tentatives par 15 minutes par IP */
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  key: "login",
  limit: 10,
  windowSeconds: 15 * 60,
};

/** Reset password : 5 tentatives par heure par IP */
export const RESET_PASSWORD_RATE_LIMIT: RateLimitConfig = {
  key: "reset-password",
  limit: 5,
  windowSeconds: 60 * 60,
};

/** API générale : 300 requêtes par minute par IP */
export const API_RATE_LIMIT: RateLimitConfig = {
  key: "api",
  limit: 300,
  windowSeconds: 60,
};
