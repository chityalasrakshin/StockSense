FROM node:22-alpine

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate

# Copy monorepo workspace configuration and package descriptors
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY configs ./configs
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma

# Install backend dependencies
RUN pnpm install --filter stocksense-backend... --filter @stocksense/configs...

# Copy backend source
COPY backend ./backend

WORKDIR /app/backend

# Generate Prisma client
RUN pnpm prisma generate

EXPOSE 4000

CMD ["pnpm", "run", "start:dev"]
