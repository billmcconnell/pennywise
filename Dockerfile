# ── base ─────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# ── builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Copy manifests first so the install layer is cached independently of source
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json    ./packages/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json    ./packages/web/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

# Workspace manifests needed so pnpm can resolve the @pennywise/shared symlink
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/api/package.json    ./packages/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json    ./packages/web/
RUN pnpm install --frozen-lockfile --prod

# Compiled output (dist/ for shared must arrive after install so the symlink target is populated)
COPY --from=builder /app/packages/api/dist    ./packages/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/web/dist    ./packages/web/dist

# Drizzle SQL files read by the migrate script at release time
COPY --from=builder /app/packages/api/drizzle ./packages/api/drizzle

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080
WORKDIR /app/packages/api
CMD ["node", "dist/server.js"]
