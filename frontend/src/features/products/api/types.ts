export type Product = {
  id: string | number;
  sku: string;
  name: string;
  unitCost: number;
  reorderPoint: number;
  reorderQty: number;
  totalStock: number;
  isLowStock: boolean;
  category?: string;
  price?: number;
  description?: string;
  photo_url?: string;
};

export type ProductFilters = {
  page?: number;
  limit?: number;
  categories?: string;
  search?: string;
  sort?: string;
};

export type ProductsResponse = {
  success: boolean;
  time: string;
  message: string;
  total_products: number;
  offset: number;
  limit: number;
  items: Product[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
  products: Product[];
};

export type ProductByIdResponse = {
  success: boolean;
  time: string;
  message: string;
  product: Product;
};

export type ProductMutationPayload = {
  name: string;
  category: string;
  price: number;
  description: string;
};
