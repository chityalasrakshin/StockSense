import PageContainer from '@/components/layout/page-container';
import { DocumentWizard } from '@/features/documents/components/document-wizard';

export const metadata = {
  title: 'StockSense — Internal Transfers',
};

export default function TransfersPage() {
  return (
    <PageContainer
      pageTitle="Internal Transfers"
      pageDescription="Relocate stock between warehouses, zones, or bin locations with net-zero ledger updates"
    >
      <DocumentWizard
        type="TRANSFER"
        title="Transfer Stock"
        description="Creates dual ledger entries: negative delta at source, positive delta at destination."
      />
    </PageContainer>
  );
}
