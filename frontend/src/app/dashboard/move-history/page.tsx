import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'StockSense — Move History',
};

export default function MoveHistoryPage() {
  return (
    <PageContainer
      pageTitle="Move History (Stock Ledger)"
      pageDescription="Immutable, append-only audit trail of every stock movement and transaction"
    >
      <Card>
        <CardHeader>
          <CardTitle>Immutable Ledger Trail</CardTitle>
          <CardDescription>
            Every validated Receipt, Delivery, Transfer, and Adjustment is permanently recorded
            here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground border rounded-lg border-dashed">
            Ledger transactions will populate automatically upon validating operations documents.
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
