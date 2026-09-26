# Observability verification

Start the application stack, then run `docker compose -f infrastructure/monitoring/docker-compose.yml up`.
Prometheus is available on port 9090 and Grafana on port 3001; import `infrastructure/monitoring/grafana-dashboard.json`.

Use `k6 run -e DOCUMENT_ID=<id> -e ACCESS_TOKEN=<jwt> tests/load/validate-documents.k6.js`. The document-validation histogram is exposed at `/api/v1/metrics`. The script accepts 409 as the expected concurrent/idempotent outcome; verify the ledger contains only one posting for a document.

Set `SENTRY_DSN` in backend, workers, and `NEXT_PUBLIC_SENTRY_DSN` in frontend. Trigger a controlled backend exception in a non-production environment and inspect the event in Sentry. Production source maps require the normal Sentry release upload credentials at build time.
