'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';
import { getFiltersMetadata, FiltersMetadata } from '../api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, RotateCcw, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const dashboardFilterParsers = {
  type: parseAsString.withDefault(''),
  status: parseAsString.withDefault(''),
  warehouse: parseAsString.withDefault(''),
  category: parseAsString.withDefault(''),
  search: parseAsString.withDefault(''),
};

interface DynamicFiltersBarProps {
  initialMetadata?: FiltersMetadata;
}

export function DynamicFiltersBar({ initialMetadata }: DynamicFiltersBarProps) {
  const [filters, setFilters] = useQueryStates(dashboardFilterParsers, {
    shallow: true,
  });

  const { data: metadata } = useQuery({
    queryKey: ['dashboard', 'filters-metadata'],
    queryFn: getFiltersMetadata,
    initialData: initialMetadata,
    staleTime: 60000,
  });

  const activeFiltersCount = [
    filters.type,
    filters.status,
    filters.warehouse,
    filters.category,
    filters.search,
  ].filter(Boolean).length;

  const handleReset = () => {
    setFilters({
      type: '',
      status: '',
      warehouse: '',
      category: '',
      search: '',
    });
  };

  return (
    <div
      data-testid="dynamic-filters-bar"
      className="space-y-3 rounded-xl border border-border/70 bg-card p-4 shadow-xs"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Dynamic Filters</h2>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
              {activeFiltersCount} active
            </Badge>
          )}
        </div>

        {activeFiltersCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset all filters
          </Button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {/* Keyword Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="filter-search"
            placeholder="Search ref or partner..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value || null })}
            className="pl-8 text-xs h-9"
          />
        </div>

        {/* Document Type */}
        <Select
          value={filters.type || 'ALL'}
          onValueChange={(val) => setFilters({ type: val === 'ALL' ? null : val })}
        >
          <SelectTrigger id="filter-type" className="text-xs h-9">
            <SelectValue placeholder="Document Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Document Types</SelectItem>
            {metadata?.documentTypes?.map((dt) => (
              <SelectItem key={dt.value} value={dt.value}>
                {dt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={filters.status || 'ALL'}
          onValueChange={(val) => setFilters({ status: val === 'ALL' ? null : val })}
        >
          <SelectTrigger id="filter-status" className="text-xs h-9">
            <SelectValue placeholder="Document Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {metadata?.statuses?.map((st) => (
              <SelectItem key={st.value} value={st.value}>
                {st.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Warehouse / Location */}
        <Select
          value={filters.warehouse || 'ALL'}
          onValueChange={(val) => setFilters({ warehouse: val === 'ALL' ? null : val })}
        >
          <SelectTrigger id="filter-warehouse" className="text-xs h-9">
            <SelectValue placeholder="Warehouse / Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Warehouses</SelectItem>
            {metadata?.warehouses?.map((wh) => (
              <SelectItem key={wh.id} value={wh.id}>
                {wh.name} {wh.shortCode ? `[${wh.shortCode}]` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category */}
        <Select
          value={filters.category || 'ALL'}
          onValueChange={(val) => setFilters({ category: val === 'ALL' ? null : val })}
        >
          <SelectTrigger id="filter-category" className="text-xs h-9">
            <SelectValue placeholder="Product Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {metadata?.categories?.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filter Pills */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
          {filters.type && (
            <Badge variant="outline" className="flex items-center gap-1 text-[11px] py-0.5">
              <span>Type: {filters.type}</span>
              <X
                className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setFilters({ type: null })}
              />
            </Badge>
          )}
          {filters.status && (
            <Badge variant="outline" className="flex items-center gap-1 text-[11px] py-0.5">
              <span>Status: {filters.status}</span>
              <X
                className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setFilters({ status: null })}
              />
            </Badge>
          )}
          {filters.warehouse && (
            <Badge variant="outline" className="flex items-center gap-1 text-[11px] py-0.5">
              <span>
                Warehouse:{' '}
                {metadata?.warehouses?.find((w) => w.id === filters.warehouse)?.name || filters.warehouse}
              </span>
              <X
                className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setFilters({ warehouse: null })}
              />
            </Badge>
          )}
          {filters.category && (
            <Badge variant="outline" className="flex items-center gap-1 text-[11px] py-0.5">
              <span>
                Category:{' '}
                {metadata?.categories?.find((c) => c.id === filters.category)?.name || filters.category}
              </span>
              <X
                className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setFilters({ category: null })}
              />
            </Badge>
          )}
          {filters.search && (
            <Badge variant="outline" className="flex items-center gap-1 text-[11px] py-0.5">
              <span>Query: &quot;{filters.search}&quot;</span>
              <X
                className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={() => setFilters({ search: null })}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
