FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY bridge/package.json ./bridge/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
RUN pnpm prisma generate
RUN pnpm build

# npm resolves @prisma/engines into a flat node_modules (no pnpm symlinks)
FROM node:22-alpine AS prisma-cli
WORKDIR /deps
COPY package.json ./
RUN node -e "const p=require('./package.json');const v=p.devDependencies?.prisma||p.dependencies?.prisma||'latest';require('fs').writeFileSync('package.json',JSON.stringify({dependencies:{prisma:v}}))" && \
    npm install

FROM base AS runner
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma.config.ts ./
# prisma CLI in its own node_modules tree so ESM resolution works
COPY --from=prisma-cli --chown=nextjs:nodejs /deps/node_modules ./prisma-modules/node_modules

COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
