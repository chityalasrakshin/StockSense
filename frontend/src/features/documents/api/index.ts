import { apiClient } from '@/lib/api-client';
import type { DocumentInput, DocumentType, DocumentStatus } from '../schemas';

export interface StockDocument {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  sourceLocationId?: string;
  destLocationId?: string;
  partnerRef?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getDocuments(type?: DocumentType): Promise<StockDocument[]> {
  try {
    const q = type ? `?type=${type}` : '';
    return await apiClient<StockDocument[]>(`/documents${q}`);
  } catch {
    return [];
  }
}

export async function createDocument(data: DocumentInput): Promise<StockDocument> {
  return apiClient<StockDocument>('/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function validateDocument(
  id: string,
  idempotencyKey?: string,
): Promise<{ success: boolean; document: StockDocument }> {
  return apiClient<{ success: boolean; document: StockDocument }>(`/documents/${id}/validate`, {
    method: 'POST',
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
}
