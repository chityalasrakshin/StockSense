import PageContainer from '@/components/layout/page-container';
import { DocumentWizard } from '@/features/documents/components/document-wizard';

export const metadata = {
  title: 'StockSense — Delivery Orders',
};

export default function DeliveriesPage() {
  return (
    <PageContainer
      pageTitle="Delivery Orders (Outgoing)"
      pageDescription="Pick, pack, and validate customer outgoing shipments"
    >
      <DocumentWizard
        type="DELIVERY"
        title="Ship Products"
        description="Stock is decremented from the designated warehouse location only upon document validation."
      />
    </PageContainer>
  );
}
