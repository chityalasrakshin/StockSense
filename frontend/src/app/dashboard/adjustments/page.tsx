import PageContainer from '@/components/layout/page-container';
import { DocumentWizard } from '@/features/documents/components/document-wizard';
import { AdjustmentsGuard } from '@/features/documents/components/adjustments-guard';

export const metadata = {
  title: 'StockSense — Stock Adjustments',
};

export default function AdjustmentsPage() {
  return (
    <PageContainer
      pageTitle="Stock Adjustments"
      pageDescription="Record physical stock count reconciliations. Manager-only: computes delta (Counted − System Qty) and posts an adjustment ledger entry."
    >
      <AdjustmentsGuard>
        <DocumentWizard
          type="ADJUSTMENT"
          title="Physical Stock Reconciliation"
          description="Enter the physically counted quantity. The system will compute and display the delta before you validate."
        />
      </AdjustmentsGuard>
    </PageContainer>
  );
}
