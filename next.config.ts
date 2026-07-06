import type { NextConfig } from "next";

const isProduction = process.env.NEXT_PUBLIC_ENVIRONMENT === "production";

/*
 * Security headers for the clinical platform (engelahealth.com).
 * This is an authenticated app holding special-category health data, so it is
 * NEVER indexed — the noindex header is applied on every route in every
 * environment, not just previews. Full CSP is hardened in Phase 2.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microphone=(self): the client app records voice-note concerns in-page.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Node runtime only — never add `export const runtime = "edge"` anywhere (OpenNext).
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },
  experimental: {
    serverActions: {
      // Client voice-note concerns upload audio through a server action;
      // the bucket itself caps files at 10 MB.
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    const headers = [
      // The whole app surface is private — keep it out of search indexes everywhere.
      {
        source: "/(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];

    if (isProduction) {
      headers.push({ source: "/(.*)", headers: securityHeaders });
    }

    return headers;
  },
};

export default nextConfig;
