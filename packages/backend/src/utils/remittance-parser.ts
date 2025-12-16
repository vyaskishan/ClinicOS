import { extractInvoiceNumbers } from './matching.utils';
import { extractDatesFromText } from './pdf-extractor';
import { normalizeCurrency } from './csv-parser';

/**
 * ENHANCED REMITTANCE PARSER
 *
 * Purpose: Parse remittance advice PDF text to extract payment information.
 *
 * Features:
 * - Payment code/reference extraction (CRITICAL for bank matching)
 * - Payer name identification
 * - Remittance date extraction
 * - Total payment amount extraction
 * - Line item parsing (invoice numbers, amounts, patient names)
 * - Multi-format support (Medicare, DVA, Private Health, etc.)
 */

export interface RemittanceLineItem {
  invoice_number: string;
  amount: number;
  patient_name?: string;
  description?: string;
}

export interface ParsedRemittance {
  payer_name: string | null;
  remittance_date: Date | null;
  payment_code: string | null; // CRITICAL: For matching to bank payments
  total_amount: number | null;
  line_items: RemittanceLineItem[];
  raw_text: string;
  parsing_confidence: number; // 0-100
}

/**
 * Parse remittance text and extract structured data
 *
 * @param text Extracted PDF text
 * @param fileName Optional filename to extract payment code from
 * @returns Parsed remittance data
 */
export function parseRemittanceText(text: string, fileName?: string): ParsedRemittance {
  const result: ParsedRemittance = {
    payer_name: null,
    remittance_date: null,
    payment_code: null,
    total_amount: null,
    line_items: [],
    raw_text: text,
    parsing_confidence: 0,
  };

  // Extract components
  result.payer_name = extractPayerName(text);

  // Extract payment code from BOTH text and filename
  const textPaymentCode = extractPaymentCode(text);
  const fileNamePaymentCode = fileName ? extractPaymentCodeFromFileName(fileName) : null;

  // Prioritize filename payment code if both exist (filename is often more reliable)
  result.payment_code = fileNamePaymentCode || textPaymentCode;

  result.remittance_date = extractRemittanceDate(text);
  result.total_amount = extractTotalAmount(text);
  result.line_items = extractLineItems(text);

  // Calculate parsing confidence
  result.parsing_confidence = calculateParsingConfidence(result);

  return result;
}

/**
 * Extract payer name from remittance text
 *
 * Looks for known payer patterns:
 * - Medicare Australia
 * - Department of Veterans' Affairs (DVA)
 * - Private Health Insurance names
 * - Medical billing companies
 *
 * @param text Remittance text
 * @returns Payer name or null
 */
export function extractPayerName(text: string): string | null {
  // Known payer patterns (case-insensitive)
  const payerPatterns = [
    /Medicare\s+Australia/i,
    /Services\s+Australia/i,
    /Department\s+of\s+Veterans['\s]?\s*Affairs/i,
    /DVA\s+Payment/i,
    /Medibank\s+Private/i,
    /BUPA\s+Health/i,
    /NIB\s+Health/i,
    /HCF\s+Health/i,
    /Australian\s+Unity/i,
    /HBF\s+Health/i,
    /Tyro\s+Payments/i,
    /Tyro\s+EFTPOS/i,
  ];

  for (const pattern of payerPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  // Fallback: Look for company name in first 200 characters
  const firstLines = text.substring(0, 200);
  const companyPattern = /^([A-Z][A-Za-z\s&]+(?:Pty|Ltd|Limited|Inc|Corporation)?)/m;
  const match = firstLines.match(companyPattern);

  if (match) {
    return match[1].trim();
  }

  return null;
}

/**
 * Extract payment code/reference from remittance text
 *
 * CRITICAL for matching remittances to bank payments.
 *
 * Looks for patterns like:
 * - "Payment Ref: MCARE2024012001"
 * - "Reference: PAY-789456"
 * - "Transaction ID: TXN123456789"
 * - "Remittance No: REM-2024-001"
 * - "Batch No: BATCH789456"
 *
 * @param text Remittance text
 * @returns Payment code or null
 */
export function extractPaymentCode(text: string): string | null {
  // Payment code patterns with labels
  const labeledPatterns = [
    /Payment\s+(?:Ref|Reference):\s*([A-Z0-9\-_]+)/i,
    /Reference\s*(?:No|Number)?:\s*([A-Z0-9\-_]+)/i,
    /Transaction\s+(?:ID|Ref|Reference):\s*([A-Z0-9\-_]+)/i,
    /Remittance\s+(?:No|Number):\s*([A-Z0-9\-_]+)/i,
    /Batch\s+(?:No|Number):\s*([A-Z0-9\-_]+)/i,
    /Payment\s+(?:No|Number):\s*([A-Z0-9\-_]+)/i,
    /Ref\s+No:\s*([A-Z0-9\-_]+)/i,
    /EFT\s+Reference:\s*([A-Z0-9\-_]+)/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const code = match[1].trim();
      // Validate: Must be at least 6 characters and not all numbers (to avoid invoice numbers)
      if (code.length >= 6 && !/^\d+$/.test(code)) {
        return code;
      }
    }
  }

  // Fallback: Look for common payment code patterns (without labels)
  const standalonePatterns = [
    /\b(MCARE\d{10,})\b/i, // Medicare: MCARE2024012001
    /\b(DVA\d{8,})\b/i, // DVA: DVA20240120
    /\b(PAY-\d{6,})\b/i, // Generic: PAY-789456
    /\b(TXN\d{9,})\b/i, // Transaction: TXN123456789
    /\b(BATCH\d{6,})\b/i, // Batch: BATCH789456
    /\b(REM-\d{4}-\d{3,})\b/i, // Remittance: REM-2024-001
  ];

  for (const pattern of standalonePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract payment code from filename
 *
 * CRITICAL for matching when payment code is in filename instead of PDF text.
 *
 * Examples:
 * - "Medicare_MCARE2024012001.pdf" → "MCARE2024012001"
 * - "DVA_Payment_DVA20240122.pdf" → "DVA20240122"
 * - "Remittance_PAY-789456_20240120.pdf" → "PAY-789456"
 * - "BATCH123456_Medicare.pdf" → "BATCH123456"
 *
 * @param fileName Original filename
 * @returns Payment code or null
 */
export function extractPaymentCodeFromFileName(fileName: string): string | null {
  // Remove file extension
  const nameWithoutExt = fileName.replace(/\.(pdf|PDF)$/, '');

  // Try the same payment code patterns as text extraction
  const standalonePatterns = [
    /\b(MCARE\d{10,})\b/i, // Medicare: MCARE2024012001
    /\b(DVA\d{8,})\b/i, // DVA: DVA20240120
    /\b(PAY-\d{6,})\b/i, // Generic: PAY-789456
    /\b(TXN\d{9,})\b/i, // Transaction: TXN123456789
    /\b(BATCH\d{6,})\b/i, // Batch: BATCH789456
    /\b(REM-\d{4}-\d{3,})\b/i, // Remittance: REM-2024-001
    /\b(REF\d{8,})\b/i, // Reference: REF12345678
    /\b(EFT\d{8,})\b/i, // EFT: EFT12345678
  ];

  for (const pattern of standalonePatterns) {
    const match = nameWithoutExt.match(pattern);
    if (match && match[1]) {
      const code = match[1].trim();
      // Validate: Must be at least 6 characters
      if (code.length >= 6) {
        console.log(`   📎 Payment code extracted from filename: "${code}"`);
        return code;
      }
    }
  }

  // Generic alphanumeric code extraction (between underscores or hyphens)
  // Example: "Medicare_ABC123XYZ_Remittance.pdf" → "ABC123XYZ"
  const genericPattern = /[_\-]([A-Z0-9]{8,})[_\-]/i;
  const genericMatch = nameWithoutExt.match(genericPattern);

  if (genericMatch && genericMatch[1]) {
    const code = genericMatch[1].trim();
    // Must be mixed alphanumeric (not all letters or all numbers)
    if (/[A-Z]/.test(code) && /\d/.test(code) && code.length >= 8) {
      console.log(`   📎 Generic payment code extracted from filename: "${code}"`);
      return code;
    }
  }

  return null;
}

/**
 * Extract remittance date from text
 *
 * Looks for dates near keywords like:
 * - "Date:", "Remittance Date:", "Payment Date:"
 * - Falls back to extracting all dates and picking the first one
 *
 * @param text Remittance text
 * @returns Remittance date or null
 */
export function extractRemittanceDate(text: string): Date | null {
  // Look for labeled dates
  const labelPatterns = [
    /(?:Remittance\s+)?Date:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    /Payment\s+Date:\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    /Processed\s+(?:on|Date):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
  ];

  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const dateStr = match[1];
      const dates = extractDatesFromText(dateStr);
      if (dates.length > 0) {
        return dates[0];
      }
    }
  }

  // Fallback: Extract all dates and pick the first one from the header (first 500 chars)
  const header = text.substring(0, 500);
  const dates = extractDatesFromText(header);

  if (dates.length > 0) {
    return dates[0];
  }

  return null;
}

/**
 * Extract total payment amount from text
 *
 * Looks for patterns like:
 * - "Total Payment: $1,350.00"
 * - "Total: $1350.00"
 * - "Amount Paid: $1,350.00"
 *
 * @param text Remittance text
 * @returns Total amount or null
 */
export function extractTotalAmount(text: string): number | null {
  const amountPatterns = [
    /Total\s+Payment:\s*\$?\s*([\d,]+\.?\d*)/i,
    /Total\s+(?:Amount)?:\s*\$?\s*([\d,]+\.?\d*)/i,
    /Amount\s+Paid:\s*\$?\s*([\d,]+\.?\d*)/i,
    /Payment\s+Amount:\s*\$?\s*([\d,]+\.?\d*)/i,
    /Grand\s+Total:\s*\$?\s*([\d,]+\.?\d*)/i,
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const amount = normalizeCurrency(match[1]);
      if (amount > 0) {
        return amount;
      }
    }
  }

  return null;
}

/**
 * Extract line items (invoice numbers, amounts, patient names)
 *
 * Parses structured data like:
 * "Invoice 123456 - $450.00 - John Smith"
 * "INV123457 $450.00 Jane Doe"
 * "123458 | $450.00 | Bob Johnson"
 *
 * @param text Remittance text
 * @returns Array of line items
 */
export function extractLineItems(text: string): RemittanceLineItem[] {
  const lineItems: RemittanceLineItem[] = [];
  const lines = text.split('\n');

  // Pattern: Invoice number followed by amount (and optional patient name)
  const linePattern =
    /(?:Invoice\s+)?(\d{6})\s*[:\-\|]?\s*\$?\s*([\d,]+\.?\d*)\s*[:\-\|]?\s*([A-Za-z\s]+)?/i;

  for (const line of lines) {
    const match = line.match(linePattern);
    if (match) {
      const invoiceNumber = match[1];
      const amount = normalizeCurrency(match[2]);
      const patientName = match[3]?.trim() || undefined;

      if (amount > 0) {
        lineItems.push({
          invoice_number: invoiceNumber,
          amount,
          patient_name: patientName,
          description: line.trim(),
        });
      }
    }
  }

  // Alternative approach: Find all 6-digit numbers and nearby amounts
  if (lineItems.length === 0) {
    const invoiceNumbers = extractInvoiceNumbers(text);

    for (const invNumber of invoiceNumbers) {
      // Find the line containing this invoice number
      const lineWithInvoice = lines.find((line) => line.includes(invNumber));

      if (lineWithInvoice) {
        // Extract amount from this line
        const amountMatch = lineWithInvoice.match(/\$?\s*([\d,]+\.?\d*)/);
        if (amountMatch) {
          const amount = normalizeCurrency(amountMatch[1]);
          if (amount > 0) {
            lineItems.push({
              invoice_number: invNumber,
              amount,
              description: lineWithInvoice.trim(),
            });
          }
        }
      }
    }
  }

  return lineItems;
}

/**
 * Calculate parsing confidence based on extracted data
 *
 * Confidence score breakdown:
 * - Payer name found: +25%
 * - Payment code found: +30% (critical for matching)
 * - Remittance date found: +20%
 * - Total amount found: +15%
 * - Line items found: +10%
 *
 * @param parsed Parsed remittance data
 * @returns Confidence score (0-100)
 */
export function calculateParsingConfidence(parsed: ParsedRemittance): number {
  let confidence = 0;

  if (parsed.payer_name) confidence += 25;
  if (parsed.payment_code) confidence += 30;
  if (parsed.remittance_date) confidence += 20;
  if (parsed.total_amount !== null && parsed.total_amount > 0) confidence += 15;
  if (parsed.line_items.length > 0) confidence += 10;

  return confidence;
}

/**
 * Validate parsed remittance data
 *
 * Checks:
 * - Line item amounts sum to total (within tolerance)
 * - All invoice numbers are 6 digits
 * - All amounts are positive
 *
 * @param parsed Parsed remittance data
 * @returns Validation result with errors
 */
export function validateParsedRemittance(parsed: ParsedRemittance): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if line items sum matches total
  if (parsed.total_amount !== null && parsed.line_items.length > 0) {
    const lineItemSum = parsed.line_items.reduce((sum, item) => sum + item.amount, 0);
    const difference = Math.abs(lineItemSum - parsed.total_amount);

    if (difference > 0.01) {
      errors.push(
        `Line items sum ($${lineItemSum.toFixed(2)}) does not match total ($${parsed.total_amount.toFixed(2)})`
      );
    }
  }

  // Validate invoice numbers (must be 6 digits)
  parsed.line_items.forEach((item, index) => {
    if (!/^\d{6}$/.test(item.invoice_number)) {
      errors.push(`Line item ${index + 1}: Invalid invoice number "${item.invoice_number}"`);
    }
  });

  // Validate amounts (must be positive)
  parsed.line_items.forEach((item, index) => {
    if (item.amount <= 0) {
      errors.push(`Line item ${index + 1}: Invalid amount $${item.amount}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
