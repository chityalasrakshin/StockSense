// ─── Document API types — mirrors backend DTOs ──────────────────────────────

export type DocumentType = 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT';
export type DocumentStatus = 'DRAFT' | 'WAITING' | 'READY' | 'DONE' | 'CANCELED';

export interface DocumentLineItem {
  id: string;
  documentId: string;
  productId: string;
  expectedQty: number;
  actualQty: number | null;
  product?: {
    id: string;
    sku: string;
    name: string;
    unitCost: number;
    uom?: { code: string; name: string } | null;
  };
}

export interface DocumentRecord {
  id: string;
  reference: string;
  type: DocumentType;
  status: DocumentStatus;
  sourceLocationId: string | null;
  destLocationId: string | null;
  contact: string | null;
  partnerRef: string | null;
  scheduleDate: string | null;
  createdById: string;
  responsibleUserId: string;
  validatedById: string | null;
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceLocation?: { id: string; name: string; shortCode: string } | null;
  destLocation?: { id: string; name: string; shortCode: string } | null;
  createdBy?: { id: string; email: string };
  lines?: DocumentLineItem[];
}

export interface PaginatedDocuments {
  items: DocumentRecord[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CreateDocumentLine {
  productId: string;
  expectedQty: number;
  actualQty?: number;
}

export interface CreateDocumentPayload {
  type: DocumentType;
  reference?: string;
  sourceLocationId?: string;
  destLocationId?: string;
  locationId?: string;
  contact?: string;
  partnerRef?: string;
  scheduleDate?: string;
  lines: CreateDocumentLine[];
}

export interface UpdateDocumentPayload {
  status?: DocumentStatus;
  sourceLocationId?: string;
  destLocationId?: string;
  contact?: string;
  partnerRef?: string;
  lines?: CreateDocumentLine[];
}

export interface DocumentFilters {
  type?: DocumentType;
  status?: DocumentStatus;
  search?: string;
  page?: number;
  limit?: number;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
}
