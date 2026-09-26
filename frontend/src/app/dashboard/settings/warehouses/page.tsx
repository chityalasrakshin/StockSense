import PageContainer from '@/components/layout/page-container';
import { LocationTree } from '@/features/warehouses/components/location-tree';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'StockSense — Warehouse Settings',
};

export default function WarehousesSettingsPage() {
  return (
    <PageContainer
      pageTitle="Warehouse Locations"
      pageDescription="Configure hierarchical warehouses, zones, racks, and bin locations (WAREHOUSE → ZONE → RACK → BIN)"
    >
      <Card>
        <CardHeader>
          <CardTitle>Location Hierarchy</CardTitle>
          <CardDescription>
            Multi-warehouse tree topology — hover any node to see management controls. Each movement
            is tracked per product × per location in the immutable ledger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LocationTree />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
