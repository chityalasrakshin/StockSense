import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { NodeSDK } from '@opentelemetry/sdk-node';

// Keep tracing exporter-neutral: deploys can set OTEL_EXPORTER_OTLP_ENDPOINT.
const sdk = new NodeSDK({ instrumentations: [getNodeAutoInstrumentations(), new PrismaInstrumentation()] });
sdk.start();
