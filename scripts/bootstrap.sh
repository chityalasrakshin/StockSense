#!/usr/bin/env bash
set -e

echo "Bootstrapping StockSense Monorepo..."

pnpm install
pnpm --filter stocksense-backend prisma:generate

echo "StockSense monorepo initialized successfully."
echo "Run 'docker compose up' or 'pnpm dev:backend' / 'pnpm dev:frontend' to start development."
