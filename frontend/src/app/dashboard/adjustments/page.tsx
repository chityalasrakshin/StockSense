import PageContainer from '@/components/layout/page-container';
import { DocumentWizard } from '@/features/documents/components/document-wizard';

export const metadata = {
  title: 'StockSense — Adjustments',
};

export default function AdjustmentsPage() {
  return (
    <PageContainer
      pageTitle="Stock Adjustments"
      pageDescription="Record physical stock count reconciliations and log audit deltas"
    >
      <DocumentWizard
        type="ADJUSTMENT"
        title="Physical Stock Reconciliation"
        description="Computes delta (Counted - Recorded System Quantity) and posts an adjustment ledger transaction."
      />
    </PageContainer>
  );
}
