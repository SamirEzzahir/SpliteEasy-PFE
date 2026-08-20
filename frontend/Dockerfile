# syntax=docker/dockerfile:1

# ---- deps: install node_modules (cached unless lockfile changes) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: produce the standalone production build ----
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# next.config.mjs rewrites() are evaluated at BUILD time and baked into
# routes-manifest.json — a runtime env var is too late. So the proxy target must
# be present here, during `npm run build`. docker-compose passes it as a build arg.
ARG BACKEND_PROXY_TARGET=http://backend:8000
ENV BACKEND_PROXY_TARGET=$BACKEND_PROXY_TARGET
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: minimal runtime image ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# `output: "standalone"` (next.config.mjs) bundles a trimmed server + the
# minimal node_modules into .next/standalone. Static assets and public files
# are copied alongside it.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# At runtime, set BACKEND_PROXY_TARGET=http://backend:8000 so the Next.js
# rewrite proxies /api/* to the FastAPI container (see docker-compose.yml).
CMD ["node", "server.js"]
