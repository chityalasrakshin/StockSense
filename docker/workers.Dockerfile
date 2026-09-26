FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY configs ./configs
COPY workers/package.json ./workers/package.json
COPY backend/prisma ./backend/prisma
RUN pnpm install --frozen-lockfile --filter workers...
COPY workers ./workers
WORKDIR /app/workers
RUN pnpm build && pnpm --filter workers --prod deploy /prod/workers

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S stocksense && adduser -S stocksense -G stocksense
COPY --from=build --chown=stocksense:stocksense /prod/workers ./
USER stocksense
CMD ["node", "dist/index.js"]
