FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY configs ./configs
COPY frontend/package.json ./frontend/package.json
RUN pnpm install --frozen-lockfile --filter frontend...
COPY frontend ./frontend
WORKDIR /app/frontend
ENV BUILD_STANDALONE=true
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN addgroup -S stocksense && adduser -S stocksense -G stocksense
COPY --from=build --chown=stocksense:stocksense /app/frontend/.next/standalone ./
COPY --from=build --chown=stocksense:stocksense /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=stocksense:stocksense /app/frontend/public ./frontend/public
USER stocksense
EXPOSE 3000
CMD ["node", "frontend/server.js"]
