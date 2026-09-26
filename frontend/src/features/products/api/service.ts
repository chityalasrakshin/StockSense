import { apiClient } from '@/lib/api-client';
import type {
  ProductFilters,
  ProductsResponse,
  ProductByIdResponse,
  ProductMutationPayload,
} from './types';

export async function getProducts(filters: ProductFilters): Promise<ProductsResponse> {
  try {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.search) params.set('search', filters.search);
    if (filters.categories) params.set('categories', filters.categories);

    return await apiClient<ProductsResponse>(`/products?${params.toString()}`);
  } catch {
    // Typed stub fallback for Phase 1/2 scaffold before backend products module is populated
    return {
      success: true,
      time: new Date().toISOString(),
      message: 'StockSense Products API Stub',
      total_products: 0,
      offset: 0,
      limit: filters.limit || 10,
      products: [],
    };
  }
}

export async function getProductById(id: number | string): Promise<ProductByIdResponse> {
  try {
    return await apiClient<ProductByIdResponse>(`/products/${id}`);
  } catch {
    return {
      success: false,
      time: new Date().toISOString(),
      message: 'Product not found',
      product: {} as import('@/constants/mock-api').Product,
    };
  }
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
