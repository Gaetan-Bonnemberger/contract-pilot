import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Requis pour le build Docker (génère un server.js autonome)
  output: "standalone",
  // Packages incompatibles avec le bundler RSC de Next.js 16
  serverExternalPackages: ["clsx", "tailwind-merge"],
};

export default nextConfig;
