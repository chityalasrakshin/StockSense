import { queryOptions, mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  validateDocument,
} from './service';
import type { DocumentFilters, CreateDocumentPayload, UpdateDocumentPayload } from './types';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const documentKeys = {
  all: ['documents'] as const,
  list: (filters: DocumentFilters) => [...documentKeys.all, 'list', filters] as const,
  detail: (id: string) => [...documentKeys.all, 'detail', id] as const,
};

// ─── Query Options ───────────────────────────────────────────────────────────

export const documentsQueryOptions = (filters: DocumentFilters) =>
  queryOptions({
    queryKey: documentKeys.list(filters),
    queryFn: () => getDocuments(filters),
  });

export const documentByIdQueryOptions = (id: string) =>
  queryOptions({
    queryKey: documentKeys.detail(id),
    queryFn: () => getDocumentById(id),
    enabled: !!id,
  });

// ─── Mutation Options ────────────────────────────────────────────────────────

export const createDocumentMutation = mutationOptions({
  mutationFn: (data: CreateDocumentPayload) => createDocument(data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: documentKeys.all });
    getQueryClient().invalidateQueries({ queryKey: ['dashboard'] });
  },
});

export const updateDocumentMutation = mutationOptions({
  mutationFn: ({ id, data }: { id: string; data: UpdateDocumentPayload }) =>
    updateDocument(id, data),
  onSuccess: (doc) => {
    getQueryClient().invalidateQueries({ queryKey: documentKeys.all });
    getQueryClient().invalidateQueries({ queryKey: documentKeys.detail(doc.id) });
  },
});

export const validateDocumentMutation = mutationOptions({
  mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) =>
    validateDocument(id, idempotencyKey),
  onSuccess: (doc) => {
    getQueryClient().invalidateQueries({ queryKey: documentKeys.all });
    getQueryClient().invalidateQueries({ queryKey: documentKeys.detail(doc.id) });
    getQueryClient().invalidateQueries({ queryKey: ['dashboard'] });
    getQueryClient().invalidateQueries({ queryKey: ['ledger'] });
  },
});
