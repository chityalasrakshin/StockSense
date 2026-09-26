'use client';

/**
 * MasterDataManagement — manage Categories and Units of Measure.
 * Manager-only (staff see read-only fallback via RBAC in parent page).
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Tag, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { Category, Uom } from '../api/product-service';
import {
  categoriesQueryOptions,
  uomsQueryOptions,
  createCategoryMutation,
  updateCategoryMutation,
  deleteCategoryMutation,
  createUomMutation,
  updateUomMutation,
  deleteUomMutation,
} from '../api/product-queries';

// ─── Category section ─────────────────────────────────────────────────────────

function CategoryDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Category | null;
}) {
  const [name, setName] = useState(editing?.name ?? '');

  React.useEffect(() => {
    if (open) setName(editing?.name ?? '');
  }, [open, editing]);

  const createMut = useMutation({
    ...createCategoryMutation,
    onSuccess: (c) => { toast.success(`${c.name} created`); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    ...updateCategoryMutation,
    onSuccess: (c) => { toast.success(`${c.name} updated`); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: { name: name.trim() } });
    } else {
      createMut.mutate({ name: name.trim() });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Category' : 'New Category'}</DialogTitle>
          <DialogDescription>Product category for grouping and filtering.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name" className="text-xs">Name *</Label>
            <Input
              id="cat-name"
              className="text-xs h-9"
              placeholder="Metals & Alloys"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesSection() {
  const { data: categories = [], isLoading } = useQuery(categoriesQueryOptions());
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const deleteMut = useMutation({
    ...deleteCategoryMutation,
    onSuccess: () => { toast.success('Category deleted'); setDeleteTarget(null); },
    onError: (e: Error) => toast.error(`Cannot delete: ${e.message}`),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Tag className="h-4 w-4 text-primary" />
            Categories ({categories.length})
          </CardTitle>
          <Button size="sm" className="h-7 text-xs" onClick={() => { setEditTarget(null); setFormOpen(true); }} id="btn-create-category">
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No categories yet.</p>
        ) : (
          <div className="space-y-1">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs rounded-md px-2 py-1.5 hover:bg-muted/50 group">
                <span className="font-medium">{c.name}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditTarget(c); setFormOpen(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CategoryDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        editing={editTarget}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Blocked if any products reference this category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── UoM section ──────────────────────────────────────────────────────────────

function UomDialog({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Uom | null }) {
  const [code, setCode] = useState(editing?.code ?? '');
  const [name, setName] = useState(editing?.name ?? '');

  React.useEffect(() => {
    if (open) { setCode(editing?.code ?? ''); setName(editing?.name ?? ''); }
  }, [open, editing]);

  const createMut = useMutation({
    ...createUomMutation,
    onSuccess: (u) => { toast.success(`${u.name} created`); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    ...updateUomMutation,
    onSuccess: (u) => { toast.success(`${u.name} updated`); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) { toast.error('Code and name are required'); return; }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: { code: code.trim(), name: name.trim() } });
    } else {
      createMut.mutate({ code: code.trim(), name: name.trim() });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit UoM' : 'New Unit of Measure'}</DialogTitle>
          <DialogDescription>Standard unit for product quantities (e.g. kg, pcs, L).</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="uom-code" className="text-xs">Code *</Label>
              <Input id="uom-code" className="text-xs h-9" placeholder="kg" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uom-name" className="text-xs">Name *</Label>
              <Input id="uom-name" className="text-xs h-9" placeholder="Kilograms" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UomsSection() {
  const { data: uoms = [], isLoading } = useQuery(uomsQueryOptions());
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Uom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Uom | null>(null);

  const deleteMut = useMutation({
    ...deleteUomMutation,
    onSuccess: () => { toast.success('UoM deleted'); setDeleteTarget(null); },
    onError: (e: Error) => toast.error(`Cannot delete: ${e.message}`),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Ruler className="h-4 w-4 text-primary" />
            Units of Measure ({uoms.length})
          </CardTitle>
          <Button size="sm" className="h-7 text-xs" onClick={() => { setEditTarget(null); setFormOpen(true); }} id="btn-create-uom">
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : uoms.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No units of measure yet.</p>
        ) : (
          <div className="space-y-1">
            {uoms.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-xs rounded-md px-2 py-1.5 hover:bg-muted/50 group">
                <div>
                  <span className="font-semibold font-mono">{u.code}</span>
                  <span className="ml-2 text-muted-foreground">{u.name}</span>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditTarget(u); setFormOpen(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => setDeleteTarget(u)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <UomDialog open={formOpen} onClose={() => { setFormOpen(false); setEditTarget(null); }} editing={editTarget} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Blocked if products reference this UoM.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function MasterDataManagement() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <CategoriesSection />
      <UomsSection />
    </div>
  );
}
