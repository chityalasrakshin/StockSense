import { apiClient } from '@/lib/api-client';

export type LocationType = 'WAREHOUSE' | 'ZONE' | 'RACK' | 'BIN';

export interface Location {
  id: string;
  name: string;
  shortCode: string;
  type: LocationType;
  parentId: string | null;
  parent?: { id: string; name: string; shortCode: string } | null;
  children?: Location[];
  _count?: { children: number };
}

export interface LocationTreeNode extends Location {
  children: LocationTreeNode[];
}

export interface CreateLocationPayload {
  name: string;
  shortCode: string;
  type: LocationType;
  parentId?: string;
}

export interface UpdateLocationPayload {
  name?: string;
  shortCode?: string;
  type?: LocationType;
  parentId?: string | null;
}

export async function getLocationTree(): Promise<LocationTreeNode[]> {
  try {
    return await apiClient<LocationTreeNode[]>('/warehouses/tree');
  } catch {
    return [];
  }
}

export async function getLocations(params?: {
  type?: LocationType;
  search?: string;
}): Promise<Location[]> {
  try {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return await apiClient<Location[]>(`/warehouses${q ? `?${q}` : ''}`);
  } catch {
    return [];
  }
}

export async function getLocationById(id: string): Promise<Location> {
  return apiClient<Location>(`/warehouses/${id}`);
}

export async function createLocation(data: CreateLocationPayload): Promise<Location> {
  return apiClient<Location>('/warehouses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateLocation(id: string, data: UpdateLocationPayload): Promise<Location> {
  return apiClient<Location>(`/warehouses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteLocation(id: string): Promise<{ message: string; id: string }> {
  return apiClient<{ message: string; id: string }>(`/warehouses/${id}`, {
    method: 'DELETE',
  });
}
