'use client';

/**
 * ProductsPanel — full-featured product list with search (pg_trgm endpoint),
 * smart filters, and RBAC-aware action controls.
 *
 * WAREHOUSE_STAFF: read-only, no create/edit/delete buttons shown.
 * INVENTORY_MANAGER: full CRUD access.
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Package,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/features/auth/context/auth-context';
import type { Product, CreateProductPayload } from '../api/product-service';
import {
  productsListQueryOptions,
  createProductMutationOptions,
  updateProductMutationOptions,
  deleteProductMutationOptions,
  categoriesQueryOptions,
  uomsQueryOptions,
} from '../api/product-queries';
import { locationsQueryOptions } from '@/features/warehouses/api/queries';

// ─── Product Form Dialog ──────────────────────────────────────────────────────

interface ProductFormDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: Product | null;
}

function ProductFormDialog({ open, onClose, editing }: ProductFormDialogProps) {
  const { data: categories = [] } = useQuery(categoriesQueryOptions());
  const { data: uoms = [] } = useQuery(uomsQueryOptions());
  const { data: locationsData } = useQuery(locationsQueryOptions());
  const locations = locationsData ?? [];

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unitCost, setUnitCost] = useState<number>(0);
  const [categoryId, setCategoryId] = useState('');
  const [uomId, setUomId] = useState('');
  const [reorderPoint, setReorderPoint] = useState<number>(10);
  const [reorderQty, setReorderQty] = useState<number>(50);
  const [initialStock, setInitialStock] = useState<number>(0);
  const [initialLocationId, setInitialLocationId] = useState('');

  React.useEffect(() => {
    if (open) {
      setSku(editing?.sku ?? '');
      setName(editing?.name ?? '');
      setUnitCost(editing?.unitCost ?? 0);
      setCategoryId(editing?.categoryId ?? '');
      setUomId(editing?.uomId ?? '');
      setReorderPoint(editing?.reorderPoint ?? 10);
      setReorderQty(editing?.reorderQty ?? 50);
      setInitialStock(0);
      setInitialLocationId('');
    }
  }, [open, editing]);

  const createMut = useMutation({
    ...createProductMutationOptions,
    onSuccess: (p) => {
      toast.success(`${p.name} created`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    ...updateProductMutationOptions,
    onSuccess: (p) => {
      toast.success(`${p.name} updated`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) {
      toast.error('SKU and name are required');
      return;
    }
    if (editing) {
      updateMut.mutate({
        id: editing.id,
        data: {
          name: name.trim(),
          unitCost,
          categoryId: categoryId || undefined,
          uomId: uomId || undefined,
          reorderPoint,
          reorderQty,
        },
      });
    } else {
      const payload: CreateProductPayload = {
        sku: sku.trim(),
        name: name.trim(),
        unitCost,
        ...(categoryId && { categoryId }),
        ...(uomId && { uomId }),
        reorderPoint,
        reorderQty,
        ...(initialStock > 0 && { initialStock }),
        ...(initialStock > 0 && initialLocationId && { initialLocationId }),
      };
      createMut.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Product' : 'New Product'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update product master data.'
              : 'Create a new product in the catalogue. Optionally set initial stock.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prod-sku" className="text-xs">SKU *</Label>
                  <Input
                    id="prod-sku"
                    className="text-xs h-9"
                    placeholder="STEEL-ROD-001"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    disabled={!!editing}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-cost" className="text-xs">Unit Cost ($)</Label>
                  <Input
                    id="prod-cost"
                    type="number"
                    min={0}
                    step={0.01}
                    className="text-xs h-9"
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-name" className="text-xs">Name *</Label>
                <Input
                  id="prod-name"
                  className="text-xs h-9"
                  placeholder="Steel Rods 10mm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prod-category" className="text-xs">Category</Label>
                  <Select value={categoryId || undefined} onValueChange={(v) => setCategoryId(v ?? '')}>
                    <SelectTrigger id="prod-category" className="text-xs h-9">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-uom" className="text-xs">Unit of Measure</Label>
                  <Select value={uomId || undefined} onValueChange={(v) => setUomId(v ?? '')}>
                    <SelectTrigger id="prod-uom" className="text-xs h-9">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No UoM</SelectItem>
                      {uoms.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prod-reorder-pt" className="text-xs">Reorder Point</Label>
                  <Input
                    id="prod-reorder-pt"
                    type="number"
                    min={0}
                    className="text-xs h-9"
                    value={reorderPoint}
                    onChange={(e) => setReorderPoint(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prod-reorder-qty" className="text-xs">Reorder Qty</Label>
                  <Input
                    id="prod-reorder-qty"
                    type="number"
                    min={1}
                    className="text-xs h-9"
                    value={reorderQty}
                    onChange={(e) => setReorderQty(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Initial stock — only on create */}
              {!editing && (
                <>
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Initial Stock (optional)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="prod-init-stock" className="text-xs">Quantity</Label>
                        <Input
                          id="prod-init-stock"
                          type="number"
                          min={0}
                          className="text-xs h-9"
                          value={initialStock}
                          onChange={(e) => setInitialStock(Number(e.target.value))}
                        />
                      </div>
                      {initialStock > 0 && (
                        <div className="space-y-1.5">
                          <Label htmlFor="prod-init-loc" className="text-xs">Location</Label>
                          <Select
                            value={initialLocationId || undefined}
                            onValueChange={(v) => setInitialLocationId(v ?? '')}
                          >
                            <SelectTrigger id="prod-init-loc" className="text-xs h-9">
                              <SelectValue placeholder="Default warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Default warehouse</SelectItem>
                              {locations.map((l) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {l.name} [{l.shortCode}]
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Products Panel ──────────────────────────────────────────────────────

export function ProductsPanel() {
  const { role } = useAuth();
  const isManager = role === 'INVENTORY_MANAGER';

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const { data: categories = [] } = useQuery(categoriesQueryOptions());

  const filters = {
    page,
    limit: 20,
    ...(search && { search }),
    ...(categoryId && { categoryId }),
    ...(lowStockOnly && { lowStock: true }),
  };

  const { data, isLoading } = useQuery(productsListQueryOptions(filters));
  const products = data?.items ?? [];
  const meta = data?.meta;

  const deleteMut = useMutation({
    ...deleteProductMutationOptions,
    onSuccess: () => {
      toast.success('Product deleted');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(`Cannot delete: ${e.message}`),
  });

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditTarget(product);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="product-search"
              placeholder="Search by name or SKU (pg_trgm)…"
              className="pl-8 text-xs h-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <Select
            value={categoryId || undefined}
            onValueChange={(v) => {
              setCategoryId(v ?? '');
              setPage(1);
            }}
          >
            <SelectTrigger id="product-filter-category" className="text-xs h-9 w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={lowStockOnly ? 'default' : 'outline'}
            size="sm"
            className="h-9 text-xs"
            onClick={() => {
              setLowStockOnly((v) => !v);
              setPage(1);
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            Low Stock Only
          </Button>
        </div>

        {/* Manager-only: Create button */}
        {isManager && (
          <Button size="sm" className="h-9 text-xs shrink-0" onClick={openCreate} id="btn-create-product">
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Product
          </Button>
        )}
      </div>

      {/* Stats row */}
      {meta && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {meta.totalItems.toLocaleString()} product{meta.totalItems !== 1 ? 's' : ''}
            {lowStockOnly && <Badge variant="destructive" className="ml-2 text-[10px]">Low Stock Filter Active</Badge>}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span>Page {meta.page} / {meta.totalPages}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 gap-3 text-muted-foreground">
          <Package className="h-10 w-10 opacity-30" />
          <p className="text-sm">No products found.</p>
          {isManager && (
            <Button size="sm" className="text-xs" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create first product
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="border-b text-muted-foreground">
                <th className="py-2.5 px-3 text-left font-semibold">
                  <span className="flex items-center gap-1">
                    Product <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="py-2.5 px-3 text-left font-semibold">Category</th>
                <th className="py-2.5 px-3 text-left font-semibold">UoM</th>
                <th className="py-2.5 px-3 text-right font-semibold">Stock</th>
                <th className="py-2.5 px-3 text-right font-semibold">Reorder At</th>
                <th className="py-2.5 px-3 text-right font-semibold">Cost</th>
                {isManager && <th className="py-2.5 px-3 w-16" />}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-muted-foreground font-mono text-[10px]">{product.sku}</p>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {product.category?.name ?? '—'}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {product.uom ? `${product.uom.name} (${product.uom.code})` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`font-bold tabular-nums ${
                        product.isLowStock
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-foreground'
                      }`}
                      data-testid={`product-stock-${product.id}`}
                    >
                      {product.totalStock}
                    </span>
                    {product.isLowStock && (
                      <AlertTriangle className="inline h-3 w-3 ml-1 text-amber-500" />
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">
                    {product.reorderPoint}
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">
                    ${product.unitCost.toFixed(2)}
                  </td>
                  {isManager && (
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(product)}
                          title="Edit product"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(product)}
                          title="Delete product"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Form */}
      {isManager && (
        <ProductFormDialog
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditTarget(null);
          }}
          editing={editTarget}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This is blocked if the product has ledger entries, stock balances, or document
              references. The backend will return an error in that case.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
