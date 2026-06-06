/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // When NEXT_PUBLIC_API_URL is empty, proxy /api/* to the local backend so
    // the frontend can talk to FastAPI without CORS headaches in development.
    if (process.env.NEXT_PUBLIC_API_URL) return [];
    const target = process.env.BACKEND_PROXY_TARGET || "http://127.0.0.1:8000";
    return [
      { source: "/api/:path*", destination: `${target}/:path*` },
    ];
  },
};

export default nextConfig;
