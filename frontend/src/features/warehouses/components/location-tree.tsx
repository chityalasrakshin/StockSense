'use client';

/**
 * LocationTree — renders the self-referencing warehouse hierarchy as an
 * expandable/collapsible tree (not a flat table).
 * Manager-only: create/edit/delete controls are hidden from WAREHOUSE_STAFF.
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Warehouse,
  Layers,
  Grid3x3,
  Box,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/features/auth/context/auth-context';
import type { Location, LocationTreeNode, LocationType, CreateLocationPayload } from '../api/service';
import {
  locationTreeQueryOptions,
  locationsQueryOptions,
  createLocationMutation,
  updateLocationMutation,
  deleteLocationMutation,
} from '../api/queries';

// ─── Icons per type ───────────────────────────────────────────────────────────
const TYPE_ICONS: Record<LocationType, React.ElementType> = {
  WAREHOUSE: Warehouse,
  ZONE: Layers,
  RACK: Grid3x3,
  BIN: Box,
};

const TYPE_COLORS: Record<LocationType, string> = {
  WAREHOUSE: 'text-indigo-600 dark:text-indigo-400',
  ZONE: 'text-teal-600 dark:text-teal-400',
  RACK: 'text-amber-600 dark:text-amber-400',
  BIN: 'text-gray-500 dark:text-gray-400',
};

const TYPE_LABELS: Record<LocationType, string> = {
  WAREHOUSE: 'Warehouse',
  ZONE: 'Zone',
  RACK: 'Rack',
  BIN: 'Bin',
};

const CHILD_TYPES: Record<LocationType, LocationType[]> = {
  WAREHOUSE: ['ZONE', 'RACK', 'BIN'],
  ZONE: ['RACK', 'BIN'],
  RACK: ['BIN'],
  BIN: [],
};

// ─── Location Form Dialog ─────────────────────────────────────────────────────

interface LocationFormDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: Location | null;
  parentId?: string | null;
  allLocations: Location[];
  defaultType?: LocationType;
}

function LocationFormDialog({
  open,
  onClose,
  editing,
  parentId,
  allLocations,
  defaultType = 'WAREHOUSE',
}: LocationFormDialogProps) {
  const [name, setName] = useState(editing?.name ?? '');
  const [shortCode, setShortCode] = useState(editing?.shortCode ?? '');
  const [type, setType] = useState<LocationType>(editing?.type ?? defaultType);
  const [selParentId, setSelParentId] = useState<string>(editing?.parentId ?? parentId ?? '');

  React.useEffect(() => {
    if (open) {
      setName(editing?.name ?? '');
      setShortCode(editing?.shortCode ?? '');
      setType(editing?.type ?? defaultType);
      setSelParentId(editing?.parentId ?? parentId ?? '');
    }
  }, [open, editing, parentId, defaultType]);

  const createMut = useMutation({
    ...createLocationMutation,
    onSuccess: (loc) => {
      toast.success(`${loc.name} created`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    ...updateLocationMutation,
    onSuccess: (loc) => {
      toast.success(`${loc.name} updated`);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPending = createMut.isPending || updateMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !shortCode.trim()) {
      toast.error('Name and short code are required');
      return;
    }
    const payload: CreateLocationPayload = {
      name: name.trim(),
      shortCode: shortCode.trim().toUpperCase(),
      type,
      ...(selParentId && { parentId: selParentId }),
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const allowedParents = allLocations.filter((l) => {
    if (type === 'WAREHOUSE') return false; // root
    if (type === 'ZONE') return l.type === 'WAREHOUSE';
    if (type === 'RACK') return l.type === 'WAREHOUSE' || l.type === 'ZONE';
    if (type === 'BIN') return l.type !== 'BIN';
    return false;
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Location' : 'Add Location'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update this location in the warehouse hierarchy.'
              : 'Create a new node in the warehouse tree (WAREHOUSE → ZONE → RACK → BIN).'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="loc-name" className="text-xs">Name *</Label>
              <Input
                id="loc-name"
                className="text-xs h-9"
                placeholder="Main Warehouse"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-code" className="text-xs">Short Code *</Label>
              <Input
                id="loc-code"
                className="text-xs h-9 uppercase"
                placeholder="WH-01"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="loc-type" className="text-xs">Type *</Label>
            <Select value={type} onValueChange={(v) => setType(v as LocationType)}>
              <SelectTrigger id="loc-type" className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['WAREHOUSE', 'ZONE', 'RACK', 'BIN'] as LocationType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type !== 'WAREHOUSE' && (
            <div className="space-y-1.5">
              <Label htmlFor="loc-parent" className="text-xs">Parent Location</Label>
              <Select
                value={selParentId || undefined}
                onValueChange={(v) => setSelParentId(v ?? '')}
              >
                <SelectTrigger id="loc-parent" className="text-xs h-9">
                  <SelectValue placeholder="No parent (root)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (root)</SelectItem>
                  {allowedParents.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} [{l.shortCode}] — {TYPE_LABELS[l.type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  location: Location | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
  isPending: boolean;
}

function DeleteConfirm({ location, onClose, onConfirm, isPending }: DeleteConfirmProps) {
  return (
    <AlertDialog open={!!location} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {location?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action is blocked if the location has child nodes, non-zero stock balances, or
            document references. The backend will return an error if any of these exist.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={() => location && onConfirm(location.id)}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Delete Location
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Tree Node ────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: LocationTreeNode;
  depth: number;
  isManager: boolean;
  allLocations: Location[];
  onEdit: (loc: Location) => void;
  onDelete: (loc: Location) => void;
  onAddChild: (parentId: string, childType: LocationType) => void;
}

function TreeNode({
  node,
  depth,
  isManager,
  allLocations,
  onEdit,
  onDelete,
  onAddChild,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children && node.children.length > 0;
  const Icon = TYPE_ICONS[node.type];
  const color = TYPE_COLORS[node.type];
  const childTypes = CHILD_TYPES[node.type];

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-muted/50 group transition-colors`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors ${hasChildren ? '' : 'invisible'}`}
          type="button"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Icon */}
        <Icon className={`h-4 w-4 shrink-0 ${color}`} />

        {/* Name + code */}
        <span className="flex-1 text-sm font-medium truncate">{node.name}</span>
        <span className="font-mono text-[10px] text-muted-foreground mr-2">[{node.shortCode}]</span>

        {/* Type badge */}
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono hidden sm:inline-flex">
          {node.type}
        </Badge>

        {/* Manager actions */}
        {isManager && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
            {childTypes.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-primary"
                title={`Add ${childTypes[0]} inside`}
                onClick={() => onAddChild(node.id, childTypes[0])}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(node)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(node)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isManager={isManager}
              allLocations={allLocations}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main LocationTree component ──────────────────────────────────────────────

export function LocationTree() {
  const { role } = useAuth();
  const isManager = role === 'INVENTORY_MANAGER';

  const { data: tree = [], isLoading } = useQuery(locationTreeQueryOptions());
  const { data: allLocations = [] } = useQuery(locationsQueryOptions());

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Location | null>(null);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [addChildType, setAddChildType] = useState<LocationType>('WAREHOUSE');
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);

  const deleteMut = useMutation({
    ...deleteLocationMutation,
    onSuccess: (_, id) => {
      toast.success('Location deleted');
      if (deleteTarget?.id === id) setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(`Cannot delete: ${e.message}`),
  });

  const openAddRoot = () => {
    setEditTarget(null);
    setAddParentId(null);
    setAddChildType('WAREHOUSE');
    setFormOpen(true);
  };

  const openEdit = (loc: Location) => {
    setEditTarget(loc);
    setAddParentId(null);
    setFormOpen(true);
  };

  const openAddChild = (parentId: string, childType: LocationType) => {
    setEditTarget(null);
    setAddParentId(parentId);
    setAddChildType(childType);
    setFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading warehouse tree…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {allLocations.length} location{allLocations.length !== 1 ? 's' : ''} across{' '}
          {tree.length} root warehouse{tree.length !== 1 ? 's' : ''}
        </p>
        {isManager && (
          <Button size="sm" className="h-8 text-xs" onClick={openAddRoot} id="btn-add-warehouse">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Warehouse
          </Button>
        )}
      </div>

      {!isManager && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Read-only view. Only Inventory Managers can add or modify locations.
        </div>
      )}

      {/* Tree */}
      {tree.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed p-10 text-sm text-muted-foreground">
          No warehouse locations configured.
          {isManager && ' Click "Add Warehouse" to create the first root warehouse.'}
        </div>
      ) : (
        <div className="rounded-lg border divide-y-0">
          {tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              isManager={isManager}
              allLocations={allLocations}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onAddChild={openAddChild}
            />
          ))}
        </div>
      )}

      {/* Form Dialog */}
      {isManager && (
        <LocationFormDialog
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditTarget(null);
          }}
          editing={editTarget}
          parentId={addParentId}
          allLocations={allLocations}
          defaultType={addChildType}
        />
      )}

      {/* Delete Confirm */}
      <DeleteConfirm
        location={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(id) => deleteMut.mutate(id)}
        isPending={deleteMut.isPending}
      />
    </div>
  );
}
