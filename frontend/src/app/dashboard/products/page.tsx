import PageContainer from '@/components/layout/page-container';
import { ProductsPanel } from '@/features/products/components/products-panel';
import { MasterDataManagement } from '@/features/products/components/master-data-management';
import { Separator } from '@/components/ui/separator';

export const metadata = {
  title: 'StockSense — Products',
  description: 'Manage products, categories, and units of measure',
};

export default function ProductsPage() {
  return (
    <PageContainer
      pageTitle="Products"
      pageDescription="Product catalogue with real-time stock balances, smart search (pg_trgm), and master data management"
    >
      <div className="space-y-6">
        <ProductsPanel />
        <Separator />
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
            Master Data
          </h2>
          <MasterDataManagement />
        </div>
      </div>
    </PageContainer>
  );
}
