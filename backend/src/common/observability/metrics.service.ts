import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly documentValidationDuration = new Histogram({ name: 'stocksense_document_validation_duration_seconds', help: 'Time spent validating a document', labelNames: ['type', 'outcome'] as const, registers: [this.registry] });
  readonly ledgerWrites = new Counter({ name: 'stocksense_ledger_writes_total', help: 'Ledger entries written', registers: [this.registry] });
  readonly otpRequests = new Counter({ name: 'stocksense_otp_requests_total', help: 'OTP requests received', registers: [this.registry] });
  readonly queueDepth = new Gauge({ name: 'stocksense_queue_depth', help: 'Pending jobs by queue', labelNames: ['queue'] as const, registers: [this.registry] });
  constructor() { collectDefaultMetrics({ register: this.registry, prefix: 'stocksense_' }); }
}
