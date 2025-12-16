import { PoolClient } from 'pg';
import { transaction } from '../config/database';
import { extractTextFromPDF } from '../utils/pdf-extractor';
import {
  parseRemittanceText,
  validateParsedRemittance,
  ParsedRemittance,
} from '../utils/remittance-parser';
import { formatDateToISO } from '../utils/csv-parser';

/**
 * REMITTANCE UPLOAD SERVICE
 *
 * Purpose: Handle PDF remittance uploads with text extraction, parsing, and storage.
 *
 * Features:
 * - Multiple PDF file upload support
 * - Text extraction with pdf-parse
 * - Enhanced parsing with payment code extraction
 * - Database storage in remittances table
 * - Validation and error reporting
 */

export interface RemittanceUploadResult {
  success: boolean;
  summary: {
    totalFiles: number;
    successCount: number;
    errorCount: number;
    totalRemittances: number;
    totalAmount: number;
    withPaymentCode: number;
    withoutPaymentCode: number;
  };
  remittances: Array<{
    file_name: string;
    remittance_id?: string;
    payer_name?: string;
    payment_code?: string;
    total_amount?: number;
    line_items_count?: number;
    parsing_confidence?: number;
  }>;
  errors: Array<{
    file_name: string;
    error: string;
  }>;
}

/**
 * Process remittance PDF upload(s)
 *
 * @param files Array of uploaded file paths
 * @returns Upload result with summary and errors
 */
export async function processRemittanceUploads(
  files: Array<{ path: string; originalname: string }>
): Promise<RemittanceUploadResult> {
  const result: RemittanceUploadResult = {
    success: true,
    summary: {
      totalFiles: files.length,
      successCount: 0,
      errorCount: 0,
      totalRemittances: 0,
      totalAmount: 0,
      withPaymentCode: 0,
      withoutPaymentCode: 0,
    },
    remittances: [],
    errors: [],
  };

  console.log(`📄 Processing ${files.length} remittance PDF(s)...`);

  for (const file of files) {
    try {
      // Process single file
      const remittanceData = await processRemittanceFile(file.path, file.originalname);

      result.remittances.push({
        file_name: file.originalname,
        remittance_id: remittanceData.remittance_id,
        payer_name: remittanceData.payer_name || undefined,
        payment_code: remittanceData.payment_code || undefined,
        total_amount: remittanceData.total_amount || undefined,
        line_items_count: remittanceData.line_items_count,
        parsing_confidence: remittanceData.parsing_confidence,
      });

      result.summary.successCount++;
      result.summary.totalRemittances++;
      result.summary.totalAmount += remittanceData.total_amount || 0;

      if (remittanceData.payment_code) {
        result.summary.withPaymentCode++;
      } else {
        result.summary.withoutPaymentCode++;
      }

      console.log(
        `   ✓ ${file.originalname}: ${remittanceData.payer_name || 'Unknown'} - $${remittanceData.total_amount?.toFixed(2) || '0.00'} (${remittanceData.line_items_count} items)`
      );
      if (remittanceData.payment_code) {
        console.log(`     Payment Code: ${remittanceData.payment_code}`);
      }
    } catch (error: any) {
      console.error(`   ✗ ${file.originalname}: ${error.message}`);
      result.errors.push({
        file_name: file.originalname,
        error: error.message || 'Failed to process PDF',
      });
      result.summary.errorCount++;
    }
  }

  result.success = result.summary.errorCount === 0;

  return result;
}

/**
 * Process a single remittance PDF file
 */
async function processRemittanceFile(
  filePath: string,
  fileName: string
): Promise<{
  remittance_id: string;
  payer_name: string | null;
  payment_code: string | null;
  total_amount: number | null;
  line_items_count: number;
  parsing_confidence: number;
}> {
  // Step 1: Extract text from PDF
  console.log(`   📖 Extracting text from ${fileName}...`);
  const extraction = await extractTextFromPDF(filePath);

  if (!extraction.success || !extraction.text) {
    throw new Error(extraction.error || 'Failed to extract text from PDF');
  }

  console.log(
    `   📝 Extracted ${extraction.text.length} characters (${extraction.metadata.pageCount} page(s))`
  );

  // Step 2: Parse remittance text (with filename for payment code extraction)
  console.log(`   🔍 Parsing remittance data...`);
  const parsed = parseRemittanceText(extraction.text, fileName);

  console.log(
    `   📊 Parsing confidence: ${parsed.parsing_confidence}% (${parsed.line_items.length} line items)`
  );

  // Step 3: Validate parsed data
  const validation = validateParsedRemittance(parsed);
  if (!validation.valid) {
    console.warn(`   ⚠️  Validation warnings:`, validation.errors);
  }

  // Step 4: Store in database
  console.log(`   💾 Storing remittance in database...`);
  const remittanceId = await storeRemittanceInDatabase(
    fileName,
    filePath,
    extraction,
    parsed
  );

  return {
    remittance_id: remittanceId,
    payer_name: parsed.payer_name,
    payment_code: parsed.payment_code,
    total_amount: parsed.total_amount,
    line_items_count: parsed.line_items.length,
    parsing_confidence: parsed.parsing_confidence,
  };
}

/**
 * Store remittance data in database
 */
async function storeRemittanceInDatabase(
  fileName: string,
  filePath: string,
  extraction: any,
  parsed: ParsedRemittance
): Promise<string> {
  return await transaction(async (client: PoolClient) => {
    // Insert remittance record
    const insertQuery = `
      INSERT INTO remittances (
        file_name,
        file_path,
        payer_name,
        payment_code,
        remittance_date,
        total_amount,
        parsed_content,
        raw_text,
        page_count,
        parsing_confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `;

    const parsedContent = {
      line_items: parsed.line_items,
      metadata: extraction.metadata,
      extracted_dates: extraction.extractedDates.map((d: Date) => formatDateToISO(d)),
    };

    const values = [
      fileName,
      filePath,
      parsed.payer_name,
      parsed.payment_code, // CRITICAL: Payment code for bank matching
      parsed.remittance_date ? formatDateToISO(parsed.remittance_date) : null,
      parsed.total_amount,
      JSON.stringify(parsedContent), // JSONB field
      parsed.raw_text,
      extraction.metadata.pageCount,
      parsed.parsing_confidence,
    ];

    const result = await client.query(insertQuery, values);
    return result.rows[0].id;
  });
}

/**
 * Get remittance by ID
 */
export async function getRemittanceById(remittanceId: string): Promise<any> {
  const { query } = await import('../config/database');

  const result = await query(
    `SELECT * FROM remittances WHERE id = $1`,
    [remittanceId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Remittance not found: ${remittanceId}`);
  }

  return result.rows[0];
}

/**
 * Get all remittances with optional filters
 */
export async function getRemittances(filters?: {
  payer_name?: string;
  payment_code?: string;
  date_from?: string;
  date_to?: string;
  min_confidence?: number;
}): Promise<any[]> {
  const { query } = await import('../config/database');

  let queryText = `
    SELECT id, file_name, payer_name, payment_code, remittance_date,
           total_amount, parsing_confidence, created_at
    FROM remittances
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramCount = 1;

  if (filters?.payer_name) {
    queryText += ` AND payer_name ILIKE $${paramCount}`;
    params.push(`%${filters.payer_name}%`);
    paramCount++;
  }

  if (filters?.payment_code) {
    queryText += ` AND payment_code = $${paramCount}`;
    params.push(filters.payment_code);
    paramCount++;
  }

  if (filters?.date_from) {
    queryText += ` AND remittance_date >= $${paramCount}`;
    params.push(filters.date_from);
    paramCount++;
  }

  if (filters?.date_to) {
    queryText += ` AND remittance_date <= $${paramCount}`;
    params.push(filters.date_to);
    paramCount++;
  }

  if (filters?.min_confidence !== undefined) {
    queryText += ` AND parsing_confidence >= $${paramCount}`;
    params.push(filters.min_confidence);
    paramCount++;
  }

  queryText += ` ORDER BY remittance_date DESC, created_at DESC`;

  const result = await query(queryText, params);
  return result.rows;
}
