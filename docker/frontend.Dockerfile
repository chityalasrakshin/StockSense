FROM node:22-alpine

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate

# Copy monorepo workspace configuration and package descriptors
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY configs ./configs
COPY frontend/package.json ./frontend/

# Install frontend dependencies
RUN pnpm install --filter stocksense-frontend... --filter @stocksense/configs...

# Copy frontend source
COPY frontend ./frontend

WORKDIR /app/frontend

EXPOSE 3000

CMD ["pnpm", "run", "dev"]
