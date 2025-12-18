/**
 * API Service Functions
 */
import apiClient from './client';
import type {
  ApiResponse,
  SummaryStats,
  UploadResponse,
  ReconciliationResult,
  ActivityItem,
  ReconciliationRequest,
} from '../types';

/**
 * Upload invoices CSV file
 */
export const uploadInvoices = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ApiResponse<UploadResponse>>(
    '/upload/invoices',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    }
  );

  return response.data.data!;
};

/**
 * Upload bank feed/payments CSV file
 */
export const uploadPayments = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ApiResponse<UploadResponse>>(
    '/upload/payments',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    }
  );

  return response.data.data!;
};

/**
 * Upload remittance PDF files (multiple)
 */
export const uploadRemittances = async (
  files: File[],
  onProgress?: (progress: number) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await apiClient.post<ApiResponse<UploadResponse>>(
    '/upload/remittances',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    }
  );

  return response.data.data!;
};

/**
 * Get summary statistics
 */
export const getSummaryStats = async (): Promise<SummaryStats> => {
  const response = await apiClient.get<ApiResponse<SummaryStats>>(
    '/stats/summary'
  );
  return response.data.data!;
};

/**
 * Run reconciliation process
 */
export const runReconciliation = async (
  request: ReconciliationRequest
): Promise<ReconciliationResult> => {
  const response = await apiClient.post<ApiResponse<ReconciliationResult>>(
    '/reconcile/run',
    request
  );
  return response.data.data!;
};

/**
 * Get recent activity
 */
export const getRecentActivity = async (
  limit: number = 5
): Promise<ActivityItem[]> => {
  const response = await apiClient.get<ApiResponse<ActivityItem[]>>(
    '/activity/recent',
    {
      params: { limit },
    }
  );
  return response.data.data!;
};

/**
 * Get reconciliation status
 */
export const getReconciliationStatus = async (
  id: string
): Promise<ReconciliationResult> => {
  const response = await apiClient.get<ApiResponse<ReconciliationResult>>(
    `/reconcile/status/${id}`
  );
  return response.data.data!;
};
