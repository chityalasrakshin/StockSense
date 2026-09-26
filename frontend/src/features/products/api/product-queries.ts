import { queryOptions, mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import {
  getProducts,
  getProductById,
  createProductApi,
  updateProductApi,
  deleteProductApi,
  getCategories,
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  getUoms,
  createUom,
  updateUom,
  deleteUom,
} from './product-service';
import type {
  ProductFilters,
  CreateProductPayload,
  UpdateProductPayload,
} from './product-service';

// ─── Products ──────────────────────────────────────────────────────────────

export const productKeys = {
  all: ['products'] as const,
  list: (filters: ProductFilters) => [...productKeys.all, 'list', filters] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
};

export const productsListQueryOptions = (filters: ProductFilters = {}) =>
  queryOptions({
    queryKey: productKeys.list(filters),
    queryFn: () => getProducts(filters),
  });

export const productDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: productKeys.detail(id),
    queryFn: () => getProductById(id),
    enabled: !!id,
  });

export const createProductMutationOptions = mutationOptions({
  mutationFn: (data: CreateProductPayload) => createProductApi(data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
    getQueryClient().invalidateQueries({ queryKey: ['dashboard'] });
  },
});

export const updateProductMutationOptions = mutationOptions({
  mutationFn: ({ id, data }: { id: string; data: UpdateProductPayload }) =>
    updateProductApi(id, data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
  },
});

export const deleteProductMutationOptions = mutationOptions({
  mutationFn: (id: string) => deleteProductApi(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
    getQueryClient().invalidateQueries({ queryKey: ['dashboard'] });
  },
});

// ─── Categories ────────────────────────────────────────────────────────────

export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
  tree: () => [...categoryKeys.all, 'tree'] as const,
};

export const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: categoryKeys.list(),
    queryFn: getCategories,
    staleTime: 60_000,
  });

export const categoryTreeQueryOptions = () =>
  queryOptions({
    queryKey: categoryKeys.tree(),
    queryFn: getCategoryTree,
    staleTime: 60_000,
  });

export const createCategoryMutation = mutationOptions({
  mutationFn: (data: { name: string; parentId?: string }) => createCategory(data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: categoryKeys.all });
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
  },
});

export const updateCategoryMutation = mutationOptions({
  mutationFn: ({ id, data }: { id: string; data: { name?: string; parentId?: string | null } }) =>
    updateCategory(id, data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: categoryKeys.all });
  },
});

export const deleteCategoryMutation = mutationOptions({
  mutationFn: (id: string) => deleteCategory(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: categoryKeys.all });
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
  },
});

// ─── UoM ───────────────────────────────────────────────────────────────────

export const uomKeys = {
  all: ['uoms'] as const,
  list: () => [...uomKeys.all, 'list'] as const,
};

export const uomsQueryOptions = () =>
  queryOptions({
    queryKey: uomKeys.list(),
    queryFn: getUoms,
    staleTime: 60_000,
  });

export const createUomMutation = mutationOptions({
  mutationFn: (data: { code: string; name: string }) => createUom(data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: uomKeys.all });
  },
});

export const updateUomMutation = mutationOptions({
  mutationFn: ({ id, data }: { id: string; data: { code?: string; name?: string } }) =>
    updateUom(id, data),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: uomKeys.all });
  },
});

export const deleteUomMutation = mutationOptions({
  mutationFn: (id: string) => deleteUom(id),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: uomKeys.all });
    getQueryClient().invalidateQueries({ queryKey: productKeys.all });
  },
});
