FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY bridge/package.json ./bridge/package.json
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy"
RUN pnpm prisma generate
COPY bridge ./bridge
RUN pnpm --filter mqtt-bridge build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 bridge && adduser --system --uid 1001 bridge
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/bridge/node_modules ./bridge/node_modules
COPY --from=build /app/bridge/dist ./bridge/dist
COPY --from=build /app/bridge/package.json ./bridge/package.json
RUN chown -R bridge:bridge /app
USER bridge
EXPOSE 4000
WORKDIR /app/bridge
CMD ["node", "dist/index.js"]
