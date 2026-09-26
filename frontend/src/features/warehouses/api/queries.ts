import { queryOptions, mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import {
  getLocationTree,
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
} from './service';
import type { CreateLocationPayload, UpdateLocationPayload } from './service';

export const warehouseKeys = {
  all: ['warehouses'] as const,
  tree: () => [...warehouseKeys.all, 'tree'] as const,
  list: () => [...warehouseKeys.all, 'list'] as const,
  detail: (id: string) => [...warehouseKeys.all, 'detail', id] as const,
};

export const locationTreeQueryOptions = () =>
  queryOptions({
    queryKey: warehouseKeys.tree(),
    queryFn: getLocationTree,
    staleTime: 30_000,
  });

export const locationsQueryOptions = () =>
  queryOptions({
    queryKey: warehouseKeys.list(),
    queryFn: () => getLocations(),
    staleTime: 30_000,
  });

export const locationByIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: warehouseKeys.detail(id),
    queryFn: () => getLocationById(id),
    enabled: !!id,
  });

export const createLocationMutation = mutationOptions({
  mutationFn: (data: CreateLocationPayload) => createLocation(data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: warehouseKeys.all });
    getQueryClient().invalidateQueries({ queryKey: ['dashboard'] });
  },
});

export const updateLocationMutation = mutationOptions({
  mutationFn: ({ id, data }: { id: string; data: UpdateLocationPayload }) =>
    updateLocation(id, data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: warehouseKeys.all });
  },
});

export const deleteLocationMutation = mutationOptions({
  mutationFn: (id: string) => deleteLocation(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: warehouseKeys.all });
    getQueryClient().invalidateQueries({ queryKey: ['dashboard'] });
  },
});
