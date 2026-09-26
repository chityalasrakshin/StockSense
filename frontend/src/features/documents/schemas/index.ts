import { z } from 'zod';

export const documentTypeSchema = z.enum(['RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT']);
export const documentStatusSchema = z.enum(['DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED']);

export const documentLineSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  expectedQty: z.number().int().min(1, 'Quantity must be at least 1'),
  actualQty: z.number().int().min(0).optional(),
});

export const documentSchema = z.object({
  type: documentTypeSchema,
  reference: z.string().optional(),
  sourceLocationId: z.string().optional(),
  destLocationId: z.string().optional(),
  locationId: z.string().optional(),
  contact: z.string().optional(),
  partnerRef: z.string().optional(),
  scheduleDate: z.string().optional(),
  lines: z.array(documentLineSchema).min(1, 'At least one line item is required'),
});

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;
export type DocumentLine = z.infer<typeof documentLineSchema>;
