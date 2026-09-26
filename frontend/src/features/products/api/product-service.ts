import { apiClient } from '@/lib/api-client';

// ─── Product types ─────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  parent?: { id: string; name: string } | null;
  _count?: { products: number };
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export interface Uom {
  id: string;
  code: string;
  name: string;
  _count?: { products: number };
}

export interface ProductBalance {
  productId: string;
  locationId: string;
  quantity: number;
  updatedAt: string;
  location?: { id: string; name: string; shortCode: string };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  unitCost: number;
  categoryId: string | null;
  uomId: string | null;
  reorderPoint: number;
  reorderQty: number;
  totalStock: number;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
  category?: Category | null;
  uom?: Uom | null;
  balances?: ProductBalance[];
}

export interface PaginatedProducts {
  items: Product[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ProductSearchResult {
  id: string;
  sku: string;
  name: string;
  unitCost: number;
  categoryName?: string | null;
  uomName?: string | null;
  uomCode?: string | null;
  totalStock: number;
  reorderPoint: number;
  reorderQty: number;
  similarityScore: number;
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  lowStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateProductPayload {
  sku: string;
  name: string;
  unitCost?: number;
  categoryId?: string;
  uomId?: string;
  reorderPoint?: number;
  reorderQty?: number;
  initialStock?: number;
  initialLocationId?: string;
}

export interface UpdateProductPayload {
  name?: string;
  unitCost?: number;
  categoryId?: string | null;
  uomId?: string | null;
  reorderPoint?: number;
  reorderQty?: number;
}

// ─── Products API ──────────────────────────────────────────────────────────

export async function getProducts(filters: ProductFilters = {}): Promise<PaginatedProducts> {
  try {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.search) params.set('search', filters.search);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.lowStock) params.set('lowStock', 'true');
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

    const qs = params.toString();
    return await apiClient<PaginatedProducts>(`/products${qs ? `?${qs}` : ''}`);
  } catch {
    return { items: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } };
  }
}

export async function searchProducts(query: string): Promise<ProductSearchResult[]> {
  try {
    if (!query || query.length < 2) return [];
    return await apiClient<ProductSearchResult[]>(`/products/search?q=${encodeURIComponent(query)}`);
  } catch {
    return [];
  }
}

export async function getProductById(id: string): Promise<Product> {
  return apiClient<Product>(`/products/${id}`);
}

export async function createProductApi(data: CreateProductPayload): Promise<Product> {
  return apiClient<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProductApi(id: string, data: UpdateProductPayload): Promise<Product> {
  return apiClient<Product>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteProductApi(id: string): Promise<{ message: string; id: string }> {
  return apiClient<{ message: string; id: string }>(`/products/${id}`, {
    method: 'DELETE',
  });
}

// ─── Categories API ────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  try {
    return await apiClient<Category[]>('/categories');
  } catch {
    return [];
  }
}

export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  try {
    return await apiClient<CategoryTreeNode[]>('/categories/tree');
  } catch {
    return [];
  }
}

export async function createCategory(data: {
  name: string;
  parentId?: string;
}): Promise<Category> {
  return apiClient<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  id: string,
  data: { name?: string; parentId?: string | null },
): Promise<Category> {
  return apiClient<Category>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: string): Promise<{ message: string; id: string }> {
  return apiClient<{ message: string; id: string }>(`/categories/${id}`, {
    method: 'DELETE',
  });
}

// ─── UoM API ───────────────────────────────────────────────────────────────

export async function getUoms(): Promise<Uom[]> {
  try {
    return await apiClient<Uom[]>('/uoms');
  } catch {
    return [];
  }
}

export async function createUom(data: { code: string; name: string }): Promise<Uom> {
  return apiClient<Uom>('/uoms', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUom(
  id: string,
  data: { code?: string; name?: string },
): Promise<Uom> {
  return apiClient<Uom>(`/uoms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteUom(id: string): Promise<{ message: string; id: string }> {
  return apiClient<{ message: string; id: string }>(`/uoms/${id}`, {
    method: 'DELETE',
  });
}
