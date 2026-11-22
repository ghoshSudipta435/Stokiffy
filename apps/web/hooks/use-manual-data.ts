'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { PriceBar, Company, FinancialStatement } from '@stock-assistant/contracts';

interface CreateCompanyRequest {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  sector: string;
  industry: string;
  isin?: string;
}

interface ImportPriceBarsVariables {
  file?: File;
  csvText?: string;
}

/**
 * Fetches the OHLCV price bars for a company.
 * GET /api/v1/companies/[id]/price-bars
 */
export function usePriceBars(companyId: string | undefined) {
  return useQuery<PriceBar[]>({
    queryKey: ['price-bars', companyId],
    queryFn: async () => {
      const response = await apiClient.get<PriceBar[]>(
        `/api/v1/companies/${encodeURIComponent(companyId!)}/price-bars`
      );
      return response.data;
    },
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });
}

/**
 * Fetches the 5-year annual financial statements for a company.
 * GET /api/v1/companies/[id]/financials
 */
export function useCompanyFinancials(companyId: string | undefined) {
  return useQuery<FinancialStatement[]>({
    queryKey: ['company-financials', companyId],
    queryFn: async () => {
      const response = await apiClient.get<FinancialStatement[]>(
        `/api/v1/companies/${encodeURIComponent(companyId!)}/financials`
      );
      return response.data;
    },
    enabled: Boolean(companyId),
    staleTime: 60_000,
  });
}

/**
 * Creates a new company.
 * POST /api/v1/companies
 */
export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation<Company, Error, CreateCompanyRequest>({
    mutationFn: async (body) => {
      const response = await apiClient.post<Company>('/api/v1/companies', body);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['screener'] });
      queryClient.invalidateQueries({ queryKey: ['watchlists'] });
    },
  });
}

interface UpsertFinancialsStatement {
  periodType: 'annual' | 'quarterly';
  fiscalYear: string;
  fiscalQuarter?: string | null;
  revenue?: number | null;
  netProfit?: number | null;
  operatingProfit?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  totalEquity?: number | null;
  totalDebt?: number | null;
  currentAssets?: number | null;
  currentLiabilities?: number | null;
  interestExpense?: number | null;
  ebit?: number | null;
  eps?: number | null;
  depreciationAmortization?: number | null;
  capitalExpenditure?: number | null;
  changeInWorkingCapital?: number | null;
  fcf?: number | null;
  dividendPerShare?: number | null;
  sharesOutstanding?: number | null;
  bookValuePerShare?: number | null;
  promoterPledgePct?: number | null;
  relatedPartyTxn?: number | null;
  auditorQualification?: string | null;
  currency?: string;
  unit?: string;
  sourceDocumentRef?: string | null;
}

/**
 * Upsert annual or quarterly financial statements for a company.
 * POST /api/v1/companies/[id]/financials
 */
export function useUpsertFinancials(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      statements: UpsertFinancialsStatement[];
    }) => {
      const response = await apiClient.post(
        `/api/v1/companies/${encodeURIComponent(companyId!)}/financials`,
        variables.statements
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-financials', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}

/**
 * Imports OHLCV price bars for a company from a CSV file or raw CSV text.
 * POST /api/v1/companies/[id]/price-bars
 */
export function useImportPriceBars(companyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<PriceBar[], Error, ImportPriceBarsVariables>({
    mutationFn: async ({ file, csvText }) => {
      const endpoint = `/api/v1/companies/${encodeURIComponent(companyId!)}/price-bars`;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err?.error?.message || 'OHLCV import failed');
        }
        const json = await response.json();
        return (json.data ?? json) as PriceBar[];
      }

      if (csvText) {
        const response = await apiClient.post<PriceBar[]>(endpoint, {
          csvText,
        });
        return response.data;
      }

      throw new Error('No file or CSV text provided');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-bars', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
    },
  });
}
