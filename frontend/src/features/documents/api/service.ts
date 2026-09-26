import { apiClient } from '@/lib/api-client';
import type {
  DocumentRecord,
  PaginatedDocuments,
  CreateDocumentPayload,
  UpdateDocumentPayload,
  DocumentFilters,
} from './types';

export async function getDocuments(filters: DocumentFilters = {}): Promise<PaginatedDocuments> {
  try {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.warehouseId) params.set('warehouseId', filters.warehouseId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    const qs = params.toString();
    return await apiClient<PaginatedDocuments>(`/documents${qs ? `?${qs}` : ''}`);
  } catch {
    return { items: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } };
  }
}

export async function getDocumentById(id: string): Promise<DocumentRecord> {
  return apiClient<DocumentRecord>(`/documents/${id}`);
}

export async function createDocument(data: CreateDocumentPayload): Promise<DocumentRecord> {
  return apiClient<DocumentRecord>('/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDocument(
  id: string,
  data: UpdateDocumentPayload,
): Promise<DocumentRecord> {
  return apiClient<DocumentRecord>(`/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function validateDocument(
  id: string,
  idempotencyKey: string,
): Promise<DocumentRecord> {
  return apiClient<DocumentRecord>(`/documents/${id}/validate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}
