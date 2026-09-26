import PageContainer from '@/components/layout/page-container';
import { MoveHistoryTable } from '@/features/ledger/components/move-history-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'StockSense — Move History',
  description: 'Immutable audit trail of every stock movement',
};

export default function MoveHistoryPage() {
  return (
    <PageContainer
      pageTitle="Move History (Stock Ledger)"
      pageDescription="Immutable, append-only audit trail of every validated stock movement. Never edited or deleted."
    >
      <Card>
        <CardHeader>
          <CardTitle>Ledger Entries</CardTitle>
          <CardDescription>
            Every validated Receipt, Delivery, Transfer, and Adjustment posts permanent ledger rows
            here. Use filters to drill into specific products, locations, or date windows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MoveHistoryTable />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
