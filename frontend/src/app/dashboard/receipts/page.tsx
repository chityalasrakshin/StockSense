import PageContainer from '@/components/layout/page-container';
import { DocumentWizard } from '@/features/documents/components/document-wizard';

export const metadata = {
  title: 'StockSense — Receipts',
};

export default function ReceiptsPage() {
  return (
    <PageContainer
      pageTitle="Receipts (Incoming)"
      pageDescription="Process incoming vendor shipments and receive stock into warehouses"
    >
      <DocumentWizard
        type="RECEIPT"
        title="Receive Products"
        description="Draft receipts are verified before stock quantities are increased in the ledger."
      />
    </PageContainer>
  );
}
