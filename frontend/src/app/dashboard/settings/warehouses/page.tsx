import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'StockSense — Warehouse Settings',
};

export default function WarehousesSettingsPage() {
  return (
    <PageContainer
      pageTitle="Warehouse Locations"
      pageDescription="Configure hierarchical warehouses, zones, racks, and bin locations"
    >
      <Card>
        <CardHeader>
          <CardTitle>Location Hierarchy</CardTitle>
          <CardDescription>
            Multi-warehouse tree topology supporting granular stock tracking down to the bin level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground border rounded-lg border-dashed">
            Warehouse configuration will load from the backend locations API.
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
