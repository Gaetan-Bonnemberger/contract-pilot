/**
 * env.ts — Validation des variables d'environnement au démarrage
 *
 * Si une variable obligatoire est manquante ou invalide, l'application
 * s'arrête immédiatement avec un message d'erreur clair plutôt que
 * de planter de façon cryptique plus tard.
 *
 * Usage : importer `env` à la place de `process.env` dans le code serveur.
 */
import { z } from "zod";

const envSchema = z.object({
  // ── Base de données ────────────────────────────────────────────────────────
  DATABASE_URL: z
    .string({ error: "DATABASE_URL est requis" })
    .min(1, "DATABASE_URL ne peut pas être vide")
    .startsWith("postgresql://", "DATABASE_URL doit commencer par postgresql://"),

  // ── Authentification ───────────────────────────────────────────────────────
  NEXTAUTH_SECRET: z
    .string({ error: "NEXTAUTH_SECRET est requis" })
    .min(32, "NEXTAUTH_SECRET doit faire au moins 32 caractères (sécurité)"),

  NEXTAUTH_URL: z
    .string({ error: "NEXTAUTH_URL est requis" })
    .url("NEXTAUTH_URL doit être une URL valide (ex: http://192.168.1.50:3000)"),

  // ── Environnement ──────────────────────────────────────────────────────────
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // ── Stockage fichiers ──────────────────────────────────────────────────────
  STORAGE_PATH: z.string().default("./storage"),

  // ── IA (optionnel — mock si absent) ───────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5"),

  // ── IA locale — Ollama (RGPD : aucune donnée ne sort de la machine) ────────
  LLM_PROVIDER: z.enum(["anthropic", "ollama", "mock"]).optional(),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("mistral:7b"),
  OLLAMA_NUM_CTX: z.coerce.number().int().positive().default(16384),
  OLLAMA_NUM_PREDICT: z.coerce.number().int().positive().default(4096),

  // ── Email (optionnel — désactivé si absent) ────────────────────────────────
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional().or(z.literal("")),
});

// Ce module ne doit jamais être importé côté client (Edge Runtime / navigateur)
// Next.js le garantit si on l'importe uniquement depuis des fichiers serveur.

function validateEnv() {
  // Pas de validation dans les workers de build Next.js qui ne voient pas toutes les vars
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    return envSchema.parse({ ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://skip/skip" });
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(
      `\n❌ Variables d'environnement invalides ou manquantes :\n${errors}\n\n` +
      `Vérifiez votre fichier .env et consultez .env.example pour les valeurs attendues.\n`
    );

    // En production, on arrête le process immédiatement
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }

    // En développement, on laisse passer pour ne pas bloquer le HMR
    console.warn("⚠️  En développement : l'application démarre malgré tout.\n");
    return result.error as unknown as z.infer<typeof envSchema>;
  }

  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;
