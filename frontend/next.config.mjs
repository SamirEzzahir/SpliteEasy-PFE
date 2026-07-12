/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for a small Docker
  // runtime image. Harmless for local `next dev` / `next start`.
  output: "standalone",
  reactStrictMode: true,
  // Don't let ESLint *style* rules (e.g. react/no-unescaped-entities) fail the
  // production build / Docker image. Lint is a dev/CI concern — run it with
  // `npm run lint`. TypeScript type errors still block the build (intentional).
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    // When NEXT_PUBLIC_API_URL is empty, proxy /api/* to the local backend so
    // the frontend can talk to FastAPI without CORS headaches in development.
    if (process.env.NEXT_PUBLIC_API_URL) return [];
    // Fallback only — BACKEND_PROXY_TARGET is normally set in .env.local (dev)
    // or by docker-compose (http://backend:8000). This default matches local dev.
    const target = process.env.BACKEND_PROXY_TARGET || "http://backend:8000";
    return [
      { source: "/api/:path*", destination: `${target}/:path*` },
    ];
  },
};

export default nextConfig;
