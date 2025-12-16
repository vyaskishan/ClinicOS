import fs from 'fs';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

/**
 * CSV PARSING UTILITIES
 *
 * Purpose: Parse and validate CSV files with comprehensive error handling.
 *
 * Features:
 * - Stream-based parsing for memory efficiency
 * - Row-by-row validation with error collection
 * - Data type validation (dates, decimals, strings)
 * - Data transformation (trim, normalize)
 * - Skips malformed rows while logging errors
 */

export interface CSVParseResult<T> {
  /** Successfully parsed rows */
  data: T[];

  /** Total rows in CSV (excluding header) */
  totalRows: number;

  /** Number of rows successfully parsed */
  successCount: number;

  /** Number of rows skipped due to errors */
  errorCount: number;

  /** Array of error messages with row numbers */
  errors: Array<{ row: number; error: string; data?: any }>;
}

export interface CSVValidationRule {
  /** Column name */
  column: string;

  /** Is this column required? */
  required?: boolean;

  /** Data type validation */
  type?: 'string' | 'number' | 'date' | 'decimal';

  /** Custom validation function */
  validate?: (value: any) => boolean | string;

  /** Transform function (runs after validation) */
  transform?: (value: any) => any;
}

/**
 * Parse CSV file with validation
 *
 * @param filePath Path to CSV file
 * @param requiredColumns Array of required column names
 * @param validationRules Optional validation rules for columns
 * @returns Parsed data with error information
 */
export async function parseCSV<T = any>(
  filePath: string,
  requiredColumns: string[],
  validationRules?: CSVValidationRule[]
): Promise<CSVParseResult<T>> {
  return new Promise((resolve, reject) => {
    const data: T[] = [];
    const errors: Array<{ row: number; error: string; data?: any }> = [];
    let totalRows = 0;
    let headerChecked = false;

    const stream = fs
      .createReadStream(filePath)
      .pipe(csvParser());

    stream
      .on('data', (row) => {
        totalRows++;

        // Check required columns on first row
        if (!headerChecked) {
          const missingColumns = requiredColumns.filter((col) => !(col in row));
          if (missingColumns.length > 0) {
            stream.destroy();
            reject(
              new Error(
                `Missing required columns: ${missingColumns.join(', ')}. Found columns: ${Object.keys(row).join(', ')}`
              )
            );
            return;
          }
          headerChecked = true;
        }

        // Validate and transform row
        const validationResult = validateRow(row, validationRules);

        if (validationResult.valid) {
          data.push(validationResult.data as T);
        } else {
          errors.push({
            row: totalRows,
            error: validationResult.errors.join('; '),
            data: row,
          });
        }
      })
      .on('end', () => {
        resolve({
          data,
          totalRows,
          successCount: data.length,
          errorCount: errors.length,
          errors,
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Parse CSV from buffer (for in-memory parsing)
 *
 * @param buffer CSV file buffer
 * @param requiredColumns Array of required column names
 * @param validationRules Optional validation rules
 * @returns Parsed data with error information
 */
export async function parseCSVFromBuffer<T = any>(
  buffer: Buffer,
  requiredColumns: string[],
  validationRules?: CSVValidationRule[]
): Promise<CSVParseResult<T>> {
  return new Promise((resolve, reject) => {
    const data: T[] = [];
    const errors: Array<{ row: number; error: string; data?: any }> = [];
    let totalRows = 0;
    let headerChecked = false;

    const stream = Readable.from(buffer).pipe(csvParser());

    stream
      .on('data', (row) => {
        totalRows++;

        // Check required columns on first row
        if (!headerChecked) {
          const missingColumns = requiredColumns.filter((col) => !(col in row));
          if (missingColumns.length > 0) {
            stream.destroy();
            reject(
              new Error(
                `Missing required columns: ${missingColumns.join(', ')}. Found columns: ${Object.keys(row).join(', ')}`
              )
            );
            return;
          }
          headerChecked = true;
        }

        // Validate and transform row
        const validationResult = validateRow(row, validationRules);

        if (validationResult.valid) {
          data.push(validationResult.data as T);
        } else {
          errors.push({
            row: totalRows,
            error: validationResult.errors.join('; '),
            data: row,
          });
        }
      })
      .on('end', () => {
        resolve({
          data,
          totalRows,
          successCount: data.length,
          errorCount: errors.length,
          errors,
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Validate a single row against validation rules
 *
 * @param row Raw CSV row data
 * @param validationRules Validation rules to apply
 * @returns Validation result with transformed data
 */
function validateRow(
  row: any,
  validationRules?: CSVValidationRule[]
): { valid: boolean; errors: string[]; data: any } {
  const errors: string[] = [];
  const transformedRow: any = { ...row };

  if (!validationRules) {
    return { valid: true, errors: [], data: transformedRow };
  }

  for (const rule of validationRules) {
    const value = row[rule.column];

    // Check required
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${rule.column} is required`);
      continue;
    }

    // Skip validation if value is empty and not required
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Type validation
    if (rule.type) {
      const typeValidation = validateType(value, rule.type);
      if (!typeValidation.valid) {
        errors.push(`${rule.column}: ${typeValidation.error}`);
        continue;
      }
    }

    // Custom validation
    if (rule.validate) {
      const customValidation = rule.validate(value);
      if (customValidation !== true) {
        errors.push(
          `${rule.column}: ${typeof customValidation === 'string' ? customValidation : 'invalid value'}`
        );
        continue;
      }
    }

    // Transform
    if (rule.transform) {
      try {
        transformedRow[rule.column] = rule.transform(value);
      } catch (error: any) {
        errors.push(`${rule.column}: transformation error - ${error.message}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: transformedRow,
  };
}

/**
 * Validate value against type
 *
 * @param value Value to validate
 * @param type Expected type
 * @returns Validation result
 */
function validateType(
  value: any,
  type: 'string' | 'number' | 'date' | 'decimal'
): { valid: boolean; error?: string } {
  switch (type) {
    case 'string':
      return { valid: typeof value === 'string' };

    case 'number':
      if (isNaN(Number(value))) {
        return { valid: false, error: 'must be a valid number' };
      }
      return { valid: true };

    case 'decimal':
      if (isNaN(Number(value))) {
        return { valid: false, error: 'must be a valid decimal number' };
      }
      // Check if it's a reasonable decimal (not NaN, Infinity, etc.)
      const num = Number(value);
      if (!isFinite(num)) {
        return { valid: false, error: 'must be a finite decimal number' };
      }
      return { valid: true };

    case 'date':
      const date = parseDate(value);
      if (!date) {
        return { valid: false, error: 'must be a valid date' };
      }
      return { valid: true };

    default:
      return { valid: true };
  }
}

/**
 * Parse date from various formats
 *
 * Supports:
 * - ISO format: 2024-01-15
 * - US format: 01/15/2024
 * - AU format: 15/01/2024
 * - Timestamp: 1234567890
 *
 * @param value Date string or timestamp
 * @returns Date object or null if invalid
 */
export function parseDate(value: any): Date | null {
  if (!value) return null;

  // Try parsing as ISO date
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try parsing as DD/MM/YYYY or MM/DD/YYYY
  const parts = String(value).split(/[\/\-]/);
  if (parts.length === 3) {
    // Try DD/MM/YYYY (Australian format)
    const d1 = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (!isNaN(d1.getTime())) {
      return d1;
    }

    // Try MM/DD/YYYY (US format)
    const d2 = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
    if (!isNaN(d2.getTime())) {
      return d2;
    }
  }

  return null;
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 *
 * @param date Date object or string
 * @returns ISO date string
 */
export function formatDateToISO(date: Date | string): string {
  const d = typeof date === 'string' ? parseDate(date) : date;
  if (!d) {
    throw new Error('Invalid date');
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Normalize currency amount to 2 decimal places
 *
 * Handles:
 * - String numbers: "123.45"
 * - Currency symbols: "$123.45", "AUD 123.45"
 * - Thousands separators: "1,234.56"
 *
 * @param value Amount string or number
 * @returns Normalized decimal number
 */
export function normalizeCurrency(value: any): number {
  if (typeof value === 'number') {
    return Number(value.toFixed(2));
  }

  // Remove currency symbols and separators
  const cleaned = String(value)
    .replace(/[$AUD\s]/g, '')
    .replace(/,/g, '');

  const num = Number(cleaned);

  if (isNaN(num)) {
    throw new Error('Invalid currency amount');
  }

  return Number(num.toFixed(2));
}

/**
 * Trim and normalize whitespace in string
 *
 * @param value String value
 * @returns Trimmed string with normalized whitespace
 */
export function normalizeString(value: any): string {
  return String(value).trim().replace(/\s+/g, ' ');
}
