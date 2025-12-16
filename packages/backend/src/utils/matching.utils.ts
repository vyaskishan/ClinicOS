import fuzzball from 'fuzzball';

/**
 * MATCHING UTILITIES
 *
 * Purpose: Provide utility functions for invoice-payment matching algorithms.
 *
 * Features:
 * - Invoice number extraction from payment descriptions
 * - Fuzzy name matching (payee/patient names)
 * - Amount comparison utilities
 * - Name normalization for better matching
 */

/**
 * Extract all 6-digit numbers from a text string (invoice numbers)
 *
 * @param text Payment description or any text
 * @returns Array of 6-digit numbers found
 *
 * @example
 * extractInvoiceNumbers("Payment for INV123456 and 654321") // ["123456", "654321"]
 */
export function extractInvoiceNumbers(text: string): string[] {
  if (!text) return [];

  // Match word boundaries to avoid partial matches
  // \b ensures we match complete 6-digit numbers, not parts of longer numbers
  const regex = /\b\d{6}\b/g;
  const matches = text.match(regex);

  return matches || [];
}

/**
 * Normalize name for better matching
 *
 * - Convert to lowercase
 * - Remove common prefixes (Dr, Mr, Mrs, Ms, Miss)
 * - Remove punctuation
 * - Remove extra whitespace
 * - Remove common suffixes (Jr, Sr, III, etc)
 *
 * @param name Name to normalize
 * @returns Normalized name
 *
 * @example
 * normalizeName("Dr. John Smith Jr.") // "john smith"
 */
export function normalizeName(name: string): string {
  if (!name) return '';

  let normalized = name.toLowerCase().trim();

  // Remove common prefixes
  const prefixes = ['dr\\.?', 'mr\\.?', 'mrs\\.?', 'ms\\.?', 'miss', 'prof\\.?', 'professor'];
  const prefixRegex = new RegExp(`^(${prefixes.join('|')})\\s+`, 'i');
  normalized = normalized.replace(prefixRegex, '');

  // Remove common suffixes
  const suffixes = ['jr\\.?', 'sr\\.?', 'ii', 'iii', 'iv', 'esq\\.?', 'phd', 'md'];
  const suffixRegex = new RegExp(`\\s+(${suffixes.join('|')})$`, 'i');
  normalized = normalized.replace(suffixRegex, '');

  // Remove punctuation
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Calculate fuzzy similarity between two names
 *
 * Uses token_set_ratio for better handling of:
 * - Name order differences (John Smith vs Smith John)
 * - Middle names/initials
 * - Partial names
 *
 * @param name1 First name
 * @param name2 Second name
 * @returns Similarity score (0-100)
 *
 * @example
 * fuzzyNameMatch("John Smith", "Smith, John") // ~100
 * fuzzyNameMatch("Dr. John A. Smith", "John Smith") // ~90
 */
export function fuzzyNameMatch(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;

  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);

  // Use token_set_ratio for better name matching
  // This handles word order and partial matches well
  return fuzzball.token_set_ratio(normalized1, normalized2);
}

/**
 * Check if payment description contains a name (payee or patient)
 *
 * @param description Payment description
 * @param payeeName Payee name from invoice
 * @param patientName Patient name from invoice
 * @param threshold Minimum similarity threshold (default: 80)
 * @returns Match result with best score and which name matched
 *
 * @example
 * descriptionContainsName("Payment to Dr. Smith for John Doe", "Dr. Smith", "John Doe", 80)
 * // { matched: true, score: 95, matchedField: 'payee' }
 */
export function descriptionContainsName(
  description: string,
  payeeName: string,
  patientName: string,
  threshold: number = 80
): { matched: boolean; score: number; matchedField: 'payee' | 'patient' | null } {
  if (!description) {
    return { matched: false, score: 0, matchedField: null };
  }

  // Check payee name
  const payeeScore = fuzzyNameMatch(description, payeeName);

  // Check patient name
  const patientScore = fuzzyNameMatch(description, patientName);

  // Return best match
  if (payeeScore >= threshold && payeeScore >= patientScore) {
    return { matched: true, score: payeeScore, matchedField: 'payee' };
  } else if (patientScore >= threshold) {
    return { matched: true, score: patientScore, matchedField: 'patient' };
  }

  return { matched: false, score: Math.max(payeeScore, patientScore), matchedField: null };
}

/**
 * Compare two amounts for exact match (within tolerance)
 *
 * Handles floating point precision issues by allowing small tolerance
 *
 * @param amount1 First amount
 * @param amount2 Second amount
 * @param tolerance Maximum difference to consider equal (default: 0.01 = 1 cent)
 * @returns True if amounts are equal within tolerance
 *
 * @example
 * amountsEqual(100.00, 100.00) // true
 * amountsEqual(100.00, 100.005) // true (within 1 cent)
 * amountsEqual(100.00, 100.02) // false
 */
export function amountsEqual(
  amount1: number,
  amount2: number,
  tolerance: number = 0.01
): boolean {
  return Math.abs(amount1 - amount2) <= tolerance;
}

/**
 * Check if payment is less than invoice amount
 *
 * @param paymentAmount Payment amount
 * @param invoiceAmount Invoice outstanding amount
 * @returns True if payment is less than invoice
 */
export function isPartialPayment(paymentAmount: number, invoiceAmount: number): boolean {
  return paymentAmount < invoiceAmount && !amountsEqual(paymentAmount, invoiceAmount);
}

/**
 * Check if payment exceeds invoice amount
 *
 * @param paymentAmount Payment amount
 * @param invoiceAmount Invoice outstanding amount
 * @returns True if payment exceeds invoice
 */
export function isOverpayment(paymentAmount: number, invoiceAmount: number): boolean {
  return paymentAmount > invoiceAmount && !amountsEqual(paymentAmount, invoiceAmount);
}

/**
 * Calculate overpayment amount
 *
 * @param paymentAmount Payment amount
 * @param invoiceAmount Invoice outstanding amount
 * @returns Overpayment amount (0 if not overpaid)
 */
export function calculateOverpayment(paymentAmount: number, invoiceAmount: number): number {
  if (isOverpayment(paymentAmount, invoiceAmount)) {
    return Number((paymentAmount - invoiceAmount).toFixed(2));
  }
  return 0;
}
