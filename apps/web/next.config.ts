import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.join(__dirname, "../..");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Ignored over plain http (local dev); enforced once deployed on https.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // packages/shared ships TypeScript source.
  transpilePackages: ["@tracker/shared"],
  turbopack: {
    // Monorepo root, so Turbopack can resolve packages/shared.
    root: repoRoot,
  },
  // Trace server files from the monorepo root so deployments include packages/shared.
  outputFileTracingRoot: repoRoot,
  poweredByHeader: false,
  experimental: {
    // Tailwind output is ~10 KB: shipping it in the HTML saves a render-blocking request (LCP).
    inlineCss: true,
    serverActions: {
      // Backup restores go through a Server Action. Vercel caps request bodies at 4.5 MB.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
