import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options",          value: "DENY" },
  { key: "X-Content-Type-Options",   value: "nosniff" },
  { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control",   value: "off" },
  { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Content Security Policy — ajuster si des ressources externes sont utilisées
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval requis par Next.js dev
      "style-src 'self' 'unsafe-inline'",                // unsafe-inline requis par Tailwind
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Requis pour le build Docker (génère un server.js autonome)
  output: "standalone",
  // Packages incompatibles avec le bundler RSC de Next.js 16
  serverExternalPackages: ["clsx", "tailwind-merge"],

  // En-têtes de sécurité HTTP sur toutes les pages
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Désactiver les infos de version dans les headers de réponse
  poweredByHeader: false,
};

export default nextConfig;
