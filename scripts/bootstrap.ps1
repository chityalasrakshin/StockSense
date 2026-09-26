# StockSense Local Environment Bootstrap Script (PowerShell)
Write-Host "Bootstrapping StockSense Monorepo..." -ForegroundColor Cyan

cmd /c "pnpm install"
if ($LASTEXITCODE -ne 0) {
    Write-Error "pnpm install failed"
    exit $LASTEXITCODE
}

Write-Host "Generating Prisma client..." -ForegroundColor Cyan
cmd /c "pnpm --filter stocksense-backend prisma:generate"

Write-Host "StockSense monorepo initialized successfully." -ForegroundColor Green
Write-Host "Run 'docker compose up' or 'pnpm dev:backend' / 'pnpm dev:frontend' to start development."
