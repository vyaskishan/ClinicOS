import {
  parseCSV,
  CSVValidationRule,
  formatDateToISO,
  normalizeCurrency,
  normalizeString,
} from '../utils/csv-parser';
import { transaction } from '../config/database';
import { detectAutoReconciliation } from '../config/auto-reconciliation';
import { PoolClient } from 'pg';

/**
 * PAYMENT UPLOAD SERVICE
 *
 * Purpose: Process CSV file uploads for bank payments with auto-reconciliation detection.
 *
 * CSV Structure:
 * payment_date,amount,description
 *
 * Features:
 * - Validates required columns
 * - Transforms dates to ISO format
 * - Normalizes currency amounts
 * - AUTO-RECONCILIATION DETECTION:
 *   * Scans description for keywords (TYRO, MEDICARE EASYCLAIM, DVA)
 *   * Sets auto_reconciled = TRUE for matched patterns
 *   * Sets auto_reconciled_source to system name
 *   * Sets status = 'auto_reconciled'
 *   * Excludes from manual reconciliation matching
 * - Transaction-based insertion
 * - Returns detailed upload summary
 */

export interface PaymentCSVRow {
  payment_date: string;
  amount: number;
  description: string;
}

export interface PaymentUploadResult {
  success: boolean;
  summary: {
    totalRows: number;
    successCount: number;
    errorCount: number;
    autoReconciledCount: number;
    requiresMatchingCount: number;
    autoReconciledBySource: Record<string, number>; // e.g., { "TYRO": 5, "MEDICARE_EASYCLAIM": 3 }
  };
  errors: Array<{ row: number; error: string }>;
}

/**
 * Required columns for payment CSV
 */
const REQUIRED_COLUMNS = ['payment_date', 'amount', 'description'];

/**
 * Validation rules for payment CSV columns
 */
const VALIDATION_RULES: CSVValidationRule[] = [
  {
    column: 'payment_date',
    required: true,
    type: 'date',
    transform: (value) => formatDateToISO(value),
  },
  {
    column: 'amount',
    required: true,
    type: 'decimal',
    validate: (value) => {
      const num = Number(value);
      if (num <= 0) {
        return 'Amount must be greater than 0';
      }
      return true;
    },
    transform: (value) => normalizeCurrency(value),
  },
  {
    column: 'description',
    required: true,
    type: 'string',
    transform: (value) => normalizeString(value),
  },
];

/**
 * Process payment CSV upload
 *
 * @param filePath Path to uploaded CSV file
 * @returns Upload result with summary and errors
 */
export async function processPaymentUpload(
  filePath: string
): Promise<PaymentUploadResult> {
  console.log(`💰 Processing payment upload: ${filePath}`);

  // Parse CSV with validation
  const parseResult = await parseCSV<PaymentCSVRow>(
    filePath,
    REQUIRED_COLUMNS,
    VALIDATION_RULES
  );

  console.log(
    `   Parsed ${parseResult.successCount}/${parseResult.totalRows} rows successfully`
  );

  if (parseResult.errorCount > 0) {
    console.warn(`   ⚠️  Skipped ${parseResult.errorCount} rows due to errors`);
  }

  // Detect auto-reconciled transactions
  let autoReconciledCount = 0;
  const autoReconciledBySource: Record<string, number> = {};

  for (const payment of parseResult.data) {
    const autoReconciliationInfo = detectAutoReconciliation(payment.description);

    if (autoReconciliationInfo) {
      autoReconciledCount++;

      // Track by source
      if (!autoReconciledBySource[autoReconciliationInfo.source]) {
        autoReconciledBySource[autoReconciliationInfo.source] = 0;
      }
      autoReconciledBySource[autoReconciliationInfo.source]++;

      console.log(
        `   🤖 Auto-reconciled detected: ${autoReconciliationInfo.displayName} - ${payment.description.substring(0, 50)}`
      );
    }
  }

  if (autoReconciledCount > 0) {
    console.log(`   ✅ Detected ${autoReconciledCount} auto-reconciled payments`);
    Object.entries(autoReconciledBySource).forEach(([source, count]) => {
      console.log(`      - ${source}: ${count}`);
    });
  }

  // Insert into database using transaction
  let insertedCount = 0;
  const insertErrors: Array<{ row: number; error: string }> = [];

  if (parseResult.data.length > 0) {
    try {
      await transaction(async (client: PoolClient) => {
        for (const payment of parseResult.data) {
          try {
            await insertPayment(client, payment);
            insertedCount++;
          } catch (error: any) {
            insertErrors.push({
              row: parseResult.data.indexOf(payment) + 1,
              error: error.message,
            });
          }
        }
      });
    } catch (error: any) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  const requiresMatchingCount = insertedCount - autoReconciledCount;

  const allErrors = [
    ...parseResult.errors.map((e) => ({ row: e.row, error: e.error })),
    ...insertErrors,
  ];

  console.log(`✅ Successfully inserted ${insertedCount} payments`);
  console.log(`   - ${autoReconciledCount} auto-reconciled`);
  console.log(`   - ${requiresMatchingCount} require matching`);

  return {
    success: true,
    summary: {
      totalRows: parseResult.totalRows,
      successCount: insertedCount,
      errorCount: allErrors.length,
      autoReconciledCount,
      requiresMatchingCount,
      autoReconciledBySource,
    },
    errors: allErrors,
  };
}

/**
 * Insert payment into database with auto-reconciliation detection
 *
 * @param client Database client
 * @param payment Payment data
 */
async function insertPayment(client: PoolClient, payment: PaymentCSVRow): Promise<void> {
  // Detect auto-reconciliation
  const autoReconciliationInfo = detectAutoReconciliation(payment.description);

  const isAutoReconciled = autoReconciliationInfo !== null;
  const autoReconciledSource = autoReconciliationInfo?.source || null;
  const status = isAutoReconciled ? 'auto_reconciled' : 'unmatched';

  const query = `
    INSERT INTO payments (
      payment_date,
      amount,
      description,
      auto_reconciled,
      auto_reconciled_source,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;

  await client.query(query, [
    payment.payment_date,
    payment.amount,
    payment.description,
    isAutoReconciled,
    autoReconciledSource,
    status,
  ]);
}
