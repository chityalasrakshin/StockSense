'use client';

/**
 * DocumentWizard — ONE shared multi-step wizard reused across all four document
 * types (RECEIPT, DELIVERY, TRANSFER, ADJUSTMENT).
 *
 * Steps:
 *   1. Header   — type-specific metadata (locations, supplier/customer ref, date)
 *   2. Lines    — add product lines with qty; ADJUSTMENT shows counted qty & delta preview
 *   3. Review   — read-only summary before creation
 *   4. Created  — draft created; advance through lifecycle → validate
 *
 * Idempotency-Key is generated once per wizard session and reused across retries
 * so double-clicking "Validate" cannot post duplicate ledger entries.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
/** Generate a UUID using the browser's built-in crypto API (no uuid package needed) */
const uuidv4 = () => crypto.randomUUID();
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Loader2,
  Package,
  Plus,
  Trash2,
  MapPin,
  FileText,
  Eye,
  Zap,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { DocumentType, DocumentRecord, CreateDocumentLine } from '../api/types';
import {
  createDocumentMutation,
  validateDocumentMutation,
  documentsQueryOptions,
} from '../api/queries';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  sku: string;
  name: string;
  unitCost: number;
  totalStock: number;
  reorderPoint: number;
  uom?: { code: string; name: string } | null;
  category?: { name: string } | null;
}

interface Location {
  id: string;
  name: string;
  shortCode: string;
  type: string;
  parentId: string | null;
}

interface WizardLine {
  id: string; // local key only
  productId: string;
  productName: string;
  productSku: string;
  systemQty: number; // current balance at selected location
  expectedQty: number;
  actualQty: number | undefined;
}

interface WizardHeader {
  contact: string;
  partnerRef: string;
  sourceLocationId: string;
  destLocationId: string;
  locationId: string;
  scheduleDate: string;
}

// ─── Config per document type ─────────────────────────────────────────────────

const DOCTYPE_CONFIG: Record<
  DocumentType,
  {
    label: string;
    color: string;
    badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
    needsSource: boolean;
    needsDest: boolean;
    needsLocation: boolean; // ADJUSTMENT only
    needsContact: boolean;
    contactLabel: string;
    qtyLabel: string;
    showActualQty: boolean;
    showDelta: boolean;
  }
> = {
  RECEIPT: {
    label: 'Receipt',
    color: 'text-teal-700 dark:text-teal-400',
    badgeVariant: 'secondary',
    needsSource: false,
    needsDest: true,
    needsLocation: false,
    needsContact: true,
    contactLabel: 'Supplier / Vendor',
    qtyLabel: 'Expected Qty',
    showActualQty: true,
    showDelta: false,
  },
  DELIVERY: {
    label: 'Delivery Order',
    color: 'text-blue-700 dark:text-blue-400',
    badgeVariant: 'secondary',
    needsSource: true,
    needsDest: false,
    needsLocation: false,
    needsContact: true,
    contactLabel: 'Customer',
    qtyLabel: 'Qty to Deliver',
    showActualQty: false,
    showDelta: false,
  },
  TRANSFER: {
    label: 'Internal Transfer',
    color: 'text-purple-700 dark:text-purple-400',
    badgeVariant: 'secondary',
    needsSource: true,
    needsDest: true,
    needsLocation: false,
    needsContact: false,
    contactLabel: '',
    qtyLabel: 'Transfer Qty',
    showActualQty: false,
    showDelta: false,
  },
  ADJUSTMENT: {
    label: 'Stock Adjustment',
    color: 'text-amber-700 dark:text-amber-400',
    badgeVariant: 'destructive',
    needsSource: false,
    needsDest: false,
    needsLocation: true,
    needsContact: false,
    contactLabel: '',
    qtyLabel: 'System Qty',
    showActualQty: true,
    showDelta: true,
  },
};

const STATUS_SEQUENCE: Array<DocumentRecord['status']> = [
  'DRAFT',
  'WAITING',
  'READY',
  'DONE',
];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  WAITING: 'Waiting',
  READY: 'Ready',
  DONE: 'Done',
  CANCELED: 'Canceled',
};

// ─── Wizard Steps ─────────────────────────────────────────────────────────────

type WizardStep = 'header' | 'lines' | 'review' | 'validate';

const STEPS: WizardStep[] = ['header', 'lines', 'review', 'validate'];

const STEP_META: Record<WizardStep, { icon: React.ElementType; label: string }> = {
  header: { icon: FileText, label: 'Header' },
  lines: { icon: Package, label: 'Add Lines' },
  review: { icon: Eye, label: 'Review' },
  validate: { icon: Zap, label: 'Validate' },
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useProducts() {
  return useQuery({
    queryKey: ['products', 'list-all'],
    queryFn: async () => {
      try {
        const r = await apiClient<{ items: Product[] }>('/products?limit=200');
        return r.items ?? [];
      } catch {
        return [] as Product[];
      }
    },
    staleTime: 60_000,
  });
}

function useLocations() {
  return useQuery({
    queryKey: ['warehouses', 'list-all'],
    queryFn: async () => {
      try {
        return await apiClient<Location[]>('/warehouses');
      } catch {
        return [] as Location[];
      }
    },
    staleTime: 60_000,
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({
  current,
  docCreated,
}: {
  current: WizardStep;
  docCreated: boolean;
}) {
  const currentIdx = STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const Meta = STEP_META[step];
        const Icon = Meta.icon;
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isLocked = step === 'validate' && !docCreated;

        return (
          <React.Fragment key={step}>
            <div
              className={`flex flex-col items-center gap-1 ${isLocked ? 'opacity-40' : ''}`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all
                  ${
                    isCompleted
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground'
                  }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {Meta.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 sm:w-12 mt-[-12px] transition-all ${
                  i < currentIdx ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentRecord['status'] }) {
  const variants: Record<string, string> = {
    DRAFT: 'bg-secondary text-secondary-foreground',
    WAITING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    READY: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    DONE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    CANCELED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${variants[status] ?? ''}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface DocumentWizardProps {
  type: DocumentType;
  title: string;
  description: string;
}

export function DocumentWizard({ type, title, description }: DocumentWizardProps) {
  const cfg = DOCTYPE_CONFIG[type];

  // Per-session idempotency key — generated once, reused across validate retries
  const idempotencyKey = useRef<string>(uuidv4());

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>('header');
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [header, setHeader] = useState<WizardHeader>({
    contact: '',
    partnerRef: '',
    sourceLocationId: '',
    destLocationId: '',
    locationId: '',
    scheduleDate: '',
  });
  const [lines, setLines] = useState<WizardLine[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newQty, setNewQty] = useState<number>(1);
  const [newActualQty, setNewActualQty] = useState<number | undefined>(undefined);
  const [headerErrors, setHeaderErrors] = useState<Record<string, string>>({});

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: products = [] } = useProducts();
  const { data: locations = [] } = useLocations();

  // For existing documents view (list below wizard)
  const { data: existingDocs } = useQuery({
    ...documentsQueryOptions({ type, limit: 10 }),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMut = useMutation({
    ...createDocumentMutation,
    onSuccess: (doc) => {
      setDocument(doc);
      setStep('validate');
      toast.success(`${cfg.label} created: ${doc.reference}`);
    },
    onError: (err: Error) => {
      toast.error(`Failed to create ${cfg.label}: ${err.message}`);
    },
  });

  const validateMut = useMutation({
    ...validateDocumentMutation,
    onSuccess: (doc) => {
      setDocument(doc);
      toast.success(`${cfg.label} ${doc.reference} validated — stock ledger updated!`);
    },
    onError: (err: Error) => {
      toast.error(`Validation failed: ${err.message}`);
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId],
  );

  const systemQtyForProduct = useCallback(
    (productId: string): number => {
      const p = products.find((pr) => pr.id === productId);
      return p?.totalStock ?? 0;
    },
    [products],
  );

  const computedDelta = useCallback(
    (line: WizardLine): number => {
      if (type !== 'ADJUSTMENT') return 0;
      const counted = line.actualQty ?? 0;
      return counted - line.systemQty;
    },
    [type],
  );

  // ── Header validation ──────────────────────────────────────────────────────
  const validateHeader = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    if (cfg.needsDest && !header.destLocationId) errs.destLocationId = 'Destination location is required';
    if (cfg.needsSource && !header.sourceLocationId) errs.sourceLocationId = 'Source location is required';
    if (cfg.needsLocation && !header.locationId) errs.locationId = 'Location is required';
    setHeaderErrors(errs);
    return Object.keys(errs).length === 0;
  }, [cfg, header]);

  // ── Add line ───────────────────────────────────────────────────────────────
  const addLine = useCallback(() => {
    if (!selectedProductId) {
      toast.error('Please select a product first');
      return;
    }
    if (newQty < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }
    if (lines.some((l) => l.productId === selectedProductId)) {
      toast.error('Product already added. Edit the quantity in the line instead.');
      return;
    }
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const sysQty = systemQtyForProduct(selectedProductId);
    setLines((prev) => [
      ...prev,
      {
        id: uuidv4(),
        productId: selectedProductId,
        productName: product.name,
        productSku: product.sku,
        systemQty: sysQty,
        expectedQty: newQty,
        actualQty: type === 'ADJUSTMENT' ? newActualQty : undefined,
      },
    ]);
    setSelectedProductId('');
    setNewQty(1);
    setNewActualQty(undefined);
  }, [selectedProductId, newQty, newActualQty, lines, products, systemQtyForProduct, type]);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const updateLineQty = useCallback((id: string, field: 'expectedQty' | 'actualQty', value: number) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, [field]: value } : l,
      ),
    );
  }, []);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (step === 'header') {
      if (!validateHeader()) return;
      setStep('lines');
    } else if (step === 'lines') {
      if (lines.length === 0) {
        toast.error('Add at least one product line');
        return;
      }
      setStep('review');
    } else if (step === 'review') {
      // Create the document draft
      const payload = {
        type,
        ...(header.contact && { contact: header.contact }),
        ...(header.partnerRef && { partnerRef: header.partnerRef }),
        ...(cfg.needsSource && header.sourceLocationId && { sourceLocationId: header.sourceLocationId }),
        ...(cfg.needsDest && header.destLocationId && { destLocationId: header.destLocationId }),
        ...(cfg.needsLocation && header.locationId && { locationId: header.locationId }),
        ...(header.scheduleDate && { scheduleDate: header.scheduleDate }),
        lines: lines.map((l) => ({
          productId: l.productId,
          expectedQty: l.expectedQty,
          ...(l.actualQty !== undefined && { actualQty: l.actualQty }),
        })) satisfies CreateDocumentLine[],
      };
      createMut.mutate(payload);
    }
  }, [step, validateHeader, lines, type, header, cfg, createMut]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  const handleValidate = useCallback(() => {
    if (!document) return;
    validateMut.mutate({
      id: document.id,
      idempotencyKey: idempotencyKey.current,
    });
  }, [document, validateMut]);

  const resetWizard = useCallback(() => {
    idempotencyKey.current = uuidv4(); // fresh key for next session
    setDocument(null);
    setStep('header');
    setLines([]);
    setHeader({ contact: '', partnerRef: '', sourceLocationId: '', destLocationId: '', locationId: '', scheduleDate: '' });
    setHeaderErrors({});
    setSelectedProductId('');
    setNewQty(1);
    setNewActualQty(undefined);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  const locationOptions = locations.filter(
    (l) => l.type === 'WAREHOUSE' || l.type === 'ZONE' || l.type === 'RACK' || l.type === 'BIN',
  );

  const isValidated = document?.status === 'DONE';
  const isCanceled = document?.status === 'CANCELED';

  return (
    <div className="space-y-6">
      {/* ── Wizard Card ── */}
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold">{title}</CardTitle>
              <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
            </div>
            <Badge variant="outline" className={`self-start text-xs font-semibold ${cfg.color}`}>
              {cfg.label}
            </Badge>
          </div>

          {/* Step indicator */}
          <div className="mt-4 flex justify-center">
            <StepIndicator current={step} docCreated={!!document} />
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* ─── STEP: Header ─── */}
          {step === 'header' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Locations &amp; References
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Source Location */}
                {cfg.needsSource && (
                  <div className="space-y-1.5">
                    <Label htmlFor="sourceLocation" className="text-xs font-medium">
                      Source Location <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={header.sourceLocationId || undefined}
                      onValueChange={(v) => setHeader((h) => ({ ...h, sourceLocationId: v ?? '' }))}
                    >
                      <SelectTrigger id="sourceLocation" className="text-xs h-9">
                        <SelectValue placeholder="Select source location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationOptions.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name} [{loc.shortCode}]
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {headerErrors.sourceLocationId && (
                      <p className="text-[11px] text-destructive">{headerErrors.sourceLocationId}</p>
                    )}
                  </div>
                )}

                {/* Destination Location */}
                {cfg.needsDest && (
                  <div className="space-y-1.5">
                    <Label htmlFor="destLocation" className="text-xs font-medium">
                      Destination Location <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={header.destLocationId || undefined}
                      onValueChange={(v) => setHeader((h) => ({ ...h, destLocationId: v ?? '' }))}
                    >
                      <SelectTrigger id="destLocation" className="text-xs h-9">
                        <SelectValue placeholder="Select destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationOptions.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name} [{loc.shortCode}]
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {headerErrors.destLocationId && (
                      <p className="text-[11px] text-destructive">{headerErrors.destLocationId}</p>
                    )}
                  </div>
                )}

                {/* Adjustment Location */}
                {cfg.needsLocation && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="adjLocation" className="text-xs font-medium">
                      Inventory Location <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={header.locationId || undefined}
                      onValueChange={(v) => setHeader((h) => ({ ...h, locationId: v ?? '' }))}
                    >
                      <SelectTrigger id="adjLocation" className="text-xs h-9">
                        <SelectValue placeholder="Select location to adjust" />
                      </SelectTrigger>
                      <SelectContent>
                        {locationOptions.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name} [{loc.shortCode}]
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {headerErrors.locationId && (
                      <p className="text-[11px] text-destructive">{headerErrors.locationId}</p>
                    )}
                  </div>
                )}

                {/* Contact */}
                {cfg.needsContact && (
                  <div className="space-y-1.5">
                    <Label htmlFor="contact" className="text-xs font-medium">
                      {cfg.contactLabel}
                    </Label>
                    <Input
                      id="contact"
                      className="text-xs h-9"
                      placeholder={`Enter ${cfg.contactLabel.toLowerCase()} name`}
                      value={header.contact}
                      onChange={(e) => setHeader((h) => ({ ...h, contact: e.target.value }))}
                    />
                  </div>
                )}

                {/* Partner Reference */}
                <div className="space-y-1.5">
                  <Label htmlFor="partnerRef" className="text-xs font-medium">
                    Reference / PO Number
                  </Label>
                  <Input
                    id="partnerRef"
                    className="text-xs h-9"
                    placeholder="e.g. PO-2026-STEEL-001"
                    value={header.partnerRef}
                    onChange={(e) => setHeader((h) => ({ ...h, partnerRef: e.target.value }))}
                  />
                </div>

                {/* Scheduled Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="schedDate" className="text-xs font-medium">
                    Scheduled Date
                  </Label>
                  <Input
                    id="schedDate"
                    type="datetime-local"
                    className="text-xs h-9"
                    value={header.scheduleDate}
                    onChange={(e) => setHeader((h) => ({ ...h, scheduleDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP: Lines ─── */}
          {step === 'lines' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Product Lines
              </h3>

              {/* Add line row */}
              <div className="rounded-lg border p-3 bg-muted/20 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Add a product line</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="lg:col-span-2">
                    <Select value={selectedProductId || undefined} onValueChange={(v) => setSelectedProductId(v ?? '')}>
                      <SelectTrigger id="add-product" className="text-xs h-9">
                        <SelectValue placeholder="Select product…" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            [{p.sku}] {p.name}
                            {p.uom ? ` (${p.uom.code})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-0.5">
                    <Label htmlFor="add-qty" className="text-[10px] text-muted-foreground">
                      {cfg.qtyLabel}
                    </Label>
                    <Input
                      id="add-qty"
                      type="number"
                      min={1}
                      className="text-xs h-9"
                      value={newQty}
                      onChange={(e) => setNewQty(Number(e.target.value))}
                    />
                  </div>

                  {cfg.showActualQty && type !== 'ADJUSTMENT' && (
                    <div className="space-y-0.5">
                      <Label htmlFor="add-actual-qty" className="text-[10px] text-muted-foreground">
                        Actual Qty (optional)
                      </Label>
                      <Input
                        id="add-actual-qty"
                        type="number"
                        min={0}
                        className="text-xs h-9"
                        placeholder="Leave blank if same"
                        value={newActualQty ?? ''}
                        onChange={(e) =>
                          setNewActualQty(e.target.value !== '' ? Number(e.target.value) : undefined)
                        }
                      />
                    </div>
                  )}

                  {type === 'ADJUSTMENT' && (
                    <div className="space-y-0.5">
                      <Label htmlFor="add-counted-qty" className="text-[10px] text-muted-foreground">
                        Counted Qty
                      </Label>
                      <Input
                        id="add-counted-qty"
                        type="number"
                        min={0}
                        className="text-xs h-9"
                        placeholder="Physical count"
                        value={newActualQty ?? ''}
                        onChange={(e) =>
                          setNewActualQty(e.target.value !== '' ? Number(e.target.value) : undefined)
                        }
                      />
                    </div>
                  )}
                </div>

                {selectedProduct && (
                  <p className="text-[11px] text-muted-foreground">
                    System stock: <span className="font-semibold">{selectedProduct.totalStock}</span>{' '}
                    {selectedProduct.uom?.code ?? 'units'} · Category:{' '}
                    {selectedProduct.category?.name ?? '—'}
                  </p>
                )}

                <Button size="sm" onClick={addLine} className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Line
                </Button>
              </div>

              {/* Lines table */}
              {lines.length > 0 ? (
                <ScrollArea className="max-h-[280px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-2 text-left font-medium">Product</th>
                        <th className="py-2 text-right font-medium">{cfg.qtyLabel}</th>
                        {cfg.showActualQty && !cfg.showDelta && (
                          <th className="py-2 text-right font-medium">Actual Qty</th>
                        )}
                        {cfg.showDelta && (
                          <>
                            <th className="py-2 text-right font-medium">System Qty</th>
                            <th className="py-2 text-right font-medium">Counted Qty</th>
                            <th className="py-2 text-right font-medium">Delta</th>
                          </>
                        )}
                        <th className="py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const delta = computedDelta(line);
                        return (
                          <tr key={line.id} className="border-b last:border-0">
                            <td className="py-2 pr-4">
                              <p className="font-medium">{line.productName}</p>
                              <p className="text-muted-foreground">{line.productSku}</p>
                            </td>
                            <td className="py-2 text-right">
                              <Input
                                type="number"
                                min={1}
                                className="h-7 w-20 text-xs text-right ml-auto"
                                value={line.expectedQty}
                                onChange={(e) =>
                                  updateLineQty(line.id, 'expectedQty', Number(e.target.value))
                                }
                              />
                            </td>
                            {cfg.showActualQty && !cfg.showDelta && (
                              <td className="py-2 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-7 w-20 text-xs text-right ml-auto"
                                  value={line.actualQty ?? ''}
                                  placeholder="—"
                                  onChange={(e) =>
                                    updateLineQty(
                                      line.id,
                                      'actualQty',
                                      e.target.value !== '' ? Number(e.target.value) : 0,
                                    )
                                  }
                                />
                              </td>
                            )}
                            {cfg.showDelta && (
                              <>
                                <td className="py-2 text-right text-muted-foreground">
                                  {line.systemQty}
                                </td>
                                <td className="py-2 text-right">
                                  <Input
                                    type="number"
                                    min={0}
                                    className="h-7 w-20 text-xs text-right ml-auto"
                                    value={line.actualQty ?? ''}
                                    placeholder="Count"
                                    onChange={(e) =>
                                      updateLineQty(
                                        line.id,
                                        'actualQty',
                                        e.target.value !== '' ? Number(e.target.value) : 0,
                                      )
                                    }
                                  />
                                </td>
                                <td
                                  className={`py-2 text-right font-semibold ${
                                    delta > 0
                                      ? 'text-emerald-600'
                                      : delta < 0
                                        ? 'text-red-600'
                                        : 'text-muted-foreground'
                                  }`}
                                >
                                  {delta > 0 ? `+${delta}` : delta}
                                </td>
                              </>
                            )}
                            <td className="py-2 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => removeLine(line.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
                  No lines added yet — use the form above to add products.
                </div>
              )}
            </div>
          )}

          {/* ─── STEP: Review ─── */}
          {step === 'review' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Review Before Creating
              </h3>

              <div className="rounded-lg border p-4 space-y-3 bg-muted/10">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <p className={`font-semibold ${cfg.color}`}>{cfg.label}</p>
                  </div>
                  {cfg.needsSource && header.sourceLocationId && (
                    <div>
                      <span className="text-muted-foreground">From</span>
                      <p className="font-medium">
                        {locationOptions.find((l) => l.id === header.sourceLocationId)?.name ?? '—'}
                      </p>
                    </div>
                  )}
                  {cfg.needsDest && header.destLocationId && (
                    <div>
                      <span className="text-muted-foreground">To</span>
                      <p className="font-medium">
                        {locationOptions.find((l) => l.id === header.destLocationId)?.name ?? '—'}
                      </p>
                    </div>
                  )}
                  {cfg.needsLocation && header.locationId && (
                    <div>
                      <span className="text-muted-foreground">Location</span>
                      <p className="font-medium">
                        {locationOptions.find((l) => l.id === header.locationId)?.name ?? '—'}
                      </p>
                    </div>
                  )}
                  {header.contact && (
                    <div>
                      <span className="text-muted-foreground">{cfg.contactLabel}</span>
                      <p className="font-medium">{header.contact}</p>
                    </div>
                  )}
                  {header.partnerRef && (
                    <div>
                      <span className="text-muted-foreground">Reference</span>
                      <p className="font-medium">{header.partnerRef}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {lines.length} Line{lines.length !== 1 ? 's' : ''}
                </p>
                {lines.map((line) => {
                  const delta = computedDelta(line);
                  return (
                    <div
                      key={line.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-medium">{line.productName}</p>
                        <p className="text-muted-foreground">{line.productSku}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="font-semibold">
                          {cfg.qtyLabel}: {line.expectedQty}
                        </p>
                        {cfg.showDelta && line.actualQty !== undefined && (
                          <p
                            className={`font-bold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}
                          >
                            Delta: {delta > 0 ? `+${delta}` : delta}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Alert>
                <CircleDot className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This will create a <strong>Draft</strong> document. Stock will only change after
                  you validate in the next step.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* ─── STEP: Validate ─── */}
          {step === 'validate' && document && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Document Created — Advance &amp; Validate
              </h3>

              {/* Document info */}
              <div className="rounded-lg border p-4 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{document.reference}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(document.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={document.status} />
                </div>

                {/* Status lifecycle bar */}
                <div className="flex items-center gap-1 text-[11px]">
                  {STATUS_SEQUENCE.map((s, i) => {
                    const current = STATUS_SEQUENCE.indexOf(document.status as typeof STATUS_SEQUENCE[number]);
                    const isReached = i <= current;
                    const isCurr = i === current;
                    return (
                      <React.Fragment key={s}>
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            isReached
                              ? isCurr
                                ? 'bg-primary text-primary-foreground font-semibold'
                                : 'bg-primary/20 text-primary font-medium'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {STATUS_LABELS[s]}
                        </span>
                        {i < STATUS_SEQUENCE.length - 1 && (
                          <span className="text-muted-foreground">→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {isValidated ? (
                <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-400">
                    <strong>{document.reference} validated!</strong> Stock ledger entries have been
                    posted. Dashboard KPIs are now updated.
                  </AlertDescription>
                </Alert>
              ) : isCanceled ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    This document was canceled and can no longer be validated.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <Zap className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Validate</strong> to post immutable stock ledger entries. This action
                    cannot be undone. The idempotency key ensures double-clicks are safe.
                  </AlertDescription>
                </Alert>
              )}

              {/* Lines summary */}
              {document.lines && document.lines.length > 0 && (
                <div className="space-y-1.5">
                  {document.lines.map((line) => (
                    <div
                      key={line.id}
                      className="flex justify-between text-xs border rounded-md px-3 py-1.5"
                    >
                      <span>
                        {line.product?.name ?? line.productId} ({line.product?.sku ?? '—'})
                      </span>
                      <span className="font-medium">× {line.expectedQty}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Navigation buttons ─── */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex gap-2">
              {step !== 'header' && step !== 'validate' && (
                <Button variant="outline" size="sm" onClick={goBack} className="text-xs h-8">
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Back
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {step === 'validate' ? (
                isValidated ? (
                  <Button size="sm" className="text-xs h-8" onClick={resetWizard}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    New {cfg.label}
                  </Button>
                ) : isCanceled ? (
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={resetWizard}>
                    Start Over
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleValidate}
                    disabled={validateMut.isPending}
                    id="btn-validate-document"
                  >
                    {validateMut.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5 mr-1" />
                    )}
                    {validateMut.isPending ? 'Validating…' : 'Validate → Post to Ledger'}
                  </Button>
                )
              ) : step === 'review' ? (
                <Button
                  size="sm"
                  className="text-xs h-8"
                  onClick={goNext}
                  disabled={createMut.isPending}
                  id="btn-create-document"
                >
                  {createMut.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  {createMut.isPending ? 'Creating…' : 'Create Draft'}
                </Button>
              ) : (
                <Button size="sm" className="text-xs h-8" onClick={goNext} id={`btn-next-${step}`}>
                  Next
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Existing documents list ── */}
      {existingDocs && existingDocs.items.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Recent {cfg.label}s
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[320px]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium">Reference</th>
                    <th className="py-2 text-left font-medium">Status</th>
                    <th className="py-2 text-left font-medium">Lines</th>
                    <th className="py-2 text-right font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {existingDocs.items.map((doc) => (
                    <tr key={doc.id} className="border-b last:border-0">
                      <td className="py-2 font-mono font-medium pr-4">{doc.reference}</td>
                      <td className="py-2">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="py-2 text-muted-foreground">{doc.lines?.length ?? 0}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
