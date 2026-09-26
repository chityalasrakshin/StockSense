import { z } from 'zod';

export const documentTypeSchema = z.enum(['RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT']);
export const documentStatusSchema = z.enum(['DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED']);

export const documentLineSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  expectedQty: z.number().int().positive('Quantity must be greater than 0'),
  actualQty: z.number().int().optional(),
});

export const documentSchema = z.object({
  type: documentTypeSchema,
  status: documentStatusSchema.default('DRAFT'),
  sourceLocationId: z.string().optional(),
  destLocationId: z.string().optional(),
  partnerRef: z.string().optional(),
  lines: z.array(documentLineSchema).min(1, 'At least one line item is required'),
});

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;
