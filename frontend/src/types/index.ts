/**
 * Type definitions for ReconX Dashboard
 */

// Summary Statistics
export interface SummaryStats {
  totalInvoicesUploaded: number;
  totalPaymentsUploaded: number;
  matchedTransactions: number;
  unmatchedTransactions: number;
  totalReconciled: number;
}

// File Upload Types
export const FileUploadType = {
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  REMITTANCES: 'remittances',
} as const;

export type FileUploadType = typeof FileUploadType[keyof typeof FileUploadType];

export interface UploadedFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  uploadedAt?: Date;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  fileCount?: number;
  recordsProcessed?: number;
}

// Reconciliation Types
export const ReconciliationStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type ReconciliationStatus = typeof ReconciliationStatus[keyof typeof ReconciliationStatus];

export interface ReconciliationStep {
  id: number;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface ReconciliationProgress {
  currentStep: number;
  totalSteps: number;
  steps: ReconciliationStep[];
  status: ReconciliationStatus;
}

export interface ReconciliationResult {
  id: string;
  timestamp: Date;
  directMatches: number;
  remittanceMatches: number;
  fuzzyMatches: number;
  totalMatches: number;
  unmatchedCount: number;
  status: ReconciliationStatus;
}

export interface ReconciliationRequest {
  invoicesFileId?: string;
  paymentsFileId?: string;
  remittanceFileIds?: string[];
}

// Recent Activity Types
export interface ActivityItem {
  id: string;
  timestamp: Date;
  filesProcessed: {
    invoices: number;
    payments: number;
    remittances: number;
  };
  matchesFound: number;
  status: ReconciliationStatus;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
  metadata?: {
    page?: number;
    perPage?: number;
    total?: number;
  };
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  code: string;
  details?: ValidationError[];

  constructor(message: string, code: string, details?: ValidationError[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}
