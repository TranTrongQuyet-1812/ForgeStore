# ==============================================================================
# ForgeStore Central Backend - Production Dockerfile (pnpm Monorepo)
# Multi-stage build: Base -> Dependencies -> Builder -> Runner
# ==============================================================================

# -------------------------------------------------------------
# Stage 1: Base Alpine with libc6, openssl & pnpm
# -------------------------------------------------------------
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@12.5.1
WORKDIR /app

# -------------------------------------------------------------
# Stage 2: Dependencies Installation
# -------------------------------------------------------------
FROM base AS dependencies
# Copy workspace manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/backend/package.json ./apps/backend/

# Copy Prisma schema
COPY apps/backend/prisma ./apps/backend/prisma/

# Install dependencies (frozen lockfile)
RUN pnpm install --frozen-lockfile

# -------------------------------------------------------------
# Stage 3: Build Packages & Backend
# -------------------------------------------------------------
FROM dependencies AS builder
# Copy compiler config
COPY tsconfig.base.json ./

# Copy packages source
COPY packages/types ./packages/types/
COPY apps/backend ./apps/backend/

# Generate Prisma Client
RUN pnpm --filter @forgestore/backend run prisma:generate

# Build shared types package
RUN pnpm --filter @forgestore/types run build

# Build Central Backend NestJS
RUN pnpm --filter @forgestore/backend run build

# Prune devDependencies to keep production image lightweight
RUN pnpm prune --prod

# Remove source TypeScript files not needed at runtime
RUN rm -rf apps/backend/src packages/types/src

# -------------------------------------------------------------
# Stage 4: Production Runner
# -------------------------------------------------------------
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat openssl dumb-init wget
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy pruned build tree preserving pnpm workspace symlinks
COPY --from=builder --chown=nestjs:nodejs /app ./

USER nestjs

EXPOSE 3000

# Docker Healthcheck for Swarm auto-healing & zero-downtime rolling update
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3000/api/v1/health || exit 1

# Use dumb-init as PID 1 to safely handle Unix signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "node apps/backend/node_modules/prisma/build/index.js migrate deploy --schema=apps/backend/prisma/schema.prisma && node apps/backend/dist/main.js"]

