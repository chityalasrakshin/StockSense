FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY configs ./configs
COPY backend/package.json ./backend/package.json
COPY backend/prisma ./backend/prisma
RUN pnpm install --frozen-lockfile --filter backend...
COPY backend ./backend
WORKDIR /app/backend
RUN pnpm prisma generate && pnpm build && pnpm --filter backend --prod deploy /prod/backend

FROM node:22-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production PORT=4000
RUN addgroup -S stocksense && adduser -S stocksense -G stocksense
COPY --from=build --chown=stocksense:stocksense /prod/backend ./
USER stocksense
EXPOSE 4000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
