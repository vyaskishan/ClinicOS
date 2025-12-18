/**
 * React Query Hooks for API Integration
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  uploadInvoices,
  uploadPayments,
  uploadRemittances,
  getSummaryStats,
  runReconciliation,
  getRecentActivity,
  getReconciliationStatus,
} from '../api/services';
import type { ReconciliationRequest } from '../types';

// Query Keys
export const queryKeys = {
  summaryStats: ['summaryStats'] as const,
  recentActivity: ['recentActivity'] as const,
  reconciliationStatus: (id: string) => ['reconciliationStatus', id] as const,
};

/**
 * Hook to fetch summary statistics
 */
export const useSummaryStats = () => {
  return useQuery({
    queryKey: queryKeys.summaryStats,
    queryFn: getSummaryStats,
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook to fetch recent activity
 */
export const useRecentActivity = (limit: number = 5) => {
  return useQuery({
    queryKey: queryKeys.recentActivity,
    queryFn: () => getRecentActivity(limit),
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook to upload invoices
 */
export const useUploadInvoices = (
  onProgress?: (progress: number) => void
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadInvoices(file, onProgress),
    onSuccess: () => {
      // Invalidate summary stats to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.summaryStats });
    },
  });
};

/**
 * Hook to upload payments
 */
export const useUploadPayments = (
  onProgress?: (progress: number) => void
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadPayments(file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.summaryStats });
    },
  });
};

/**
 * Hook to upload remittances
 */
export const useUploadRemittances = (
  onProgress?: (progress: number) => void
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files: File[]) => uploadRemittances(files, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.summaryStats });
    },
  });
};

/**
 * Hook to run reconciliation
 */
export const useRunReconciliation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ReconciliationRequest) => runReconciliation(request),
    onSuccess: () => {
      // Invalidate stats and activity
      queryClient.invalidateQueries({ queryKey: queryKeys.summaryStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
  });
};

/**
 * Hook to get reconciliation status (for polling)
 */
export const useReconciliationStatus = (id: string | null, enabled: boolean = false) => {
  return useQuery({
    queryKey: id ? queryKeys.reconciliationStatus(id) : ['reconciliationStatus'],
    queryFn: () => (id ? getReconciliationStatus(id) : Promise.reject('No ID')),
    enabled: enabled && !!id,
    refetchInterval: enabled ? 2000 : false, // Poll every 2 seconds when enabled
  });
};
