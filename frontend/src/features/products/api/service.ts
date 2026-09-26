import { apiClient } from '@/lib/api-client';
import type {
  ProductFilters,
  ProductsResponse,
  ProductByIdResponse,
  ProductMutationPayload,
  Product,
} from './types';

export async function getProducts(filters: ProductFilters): Promise<ProductsResponse> {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.search) params.set('search', filters.search);
  const response = await apiClient<{ items: Product[]; meta: ProductsResponse['meta'] }>(`/products?${params.toString()}`);
  return { ...response, products: response.items, total_products: response.meta.totalItems, offset: (response.meta.page - 1) * response.meta.limit, limit: response.meta.limit, success: true, time: new Date().toISOString(), message: 'OK' };
}

export async function getProductById(id: number | string): Promise<ProductByIdResponse> {
  return apiClient<ProductByIdResponse>(`/products/${id}`);
}

export async function createProduct(data: ProductMutationPayload) {
  return apiClient('/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProduct(id: number | string, data: ProductMutationPayload) {
  return apiClient(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: number | string) {
  return apiClient(`/products/${id}`, {
    method: 'DELETE',
  });
}
