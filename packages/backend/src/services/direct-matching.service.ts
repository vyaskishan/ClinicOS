import { PoolClient } from 'pg';
import { transaction } from '../config/database';
import {
  extractInvoiceNumbers,
  descriptionContainsName,
  amountsEqual,
  isPartialPayment,
  isOverpayment,
  calculateOverpayment,
  fuzzyNameMatch,
} from '../utils/matching.utils';

/**
 * DIRECT MATCHING SERVICE
 *
 * Purpose: Level 1 matching algorithm for invoice-payment reconciliation.
 *
 * Implements 5 matching strategies in priority order:
 * 1. Perfect Match (100% confidence) - Invoice # + exact amount
 * 2. Partial Payment (95% confidence) - Invoice # + amount < outstanding
 * 3. Overpayment (90% confidence) - Invoice # + amount > outstanding
 * 4. High Confidence Single Match (90% confidence) - Exact amount + single invoice
 * 5. Exact Amount with Payer Match (85% confidence) - Exact amount + payer name
 *
 * CRITICAL: Excludes auto-reconciled payments (auto_reconciled=TRUE)
 */

export interface DirectMatchResult {
  match_id: string;
  payment_id: string;
  invoice_id: string;
  match_type:
    | 'perfect_match'
    | 'partial_payment'
    | 'overpaid'
    | 'high_confidence_match'
    | 'exact_amount_payer';
  confidence: number;
  amount_matched: number;
  requires_review: boolean;
  details: {
    reason: string;
    matched_fields: string[];
    name_similarity?: number;
    amount_difference?: number;
  };
}

export interface DirectMatchOptions {
  invoice_ids?: string[];
  payment_ids?: string[];
  exclude_auto_reconciled?: boolean;
  auto_confirm_perfect_matches?: boolean;
}

export interface DirectMatchSummary {
  total_matches: number;
  by_type: Record<string, number>;
  auto_confirmed: number;
  requires_review: number;
  matches: DirectMatchResult[];
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  patient_name: string;
  payee_name: string;
  amount: number;
  outstanding_amount: number;
  status: string;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  description: string;
  auto_reconciled: boolean;
  auto_reconciled_source: string | null;
  status: string;
}

/**
 * Run direct matching algorithm
 *
 * @param options Matching options
 * @returns Summary of matches created
 */
export async function runDirectMatching(
  options: DirectMatchOptions = {}
): Promise<DirectMatchSummary> {
  const {
    invoice_ids,
    payment_ids,
    exclude_auto_reconciled = true,
    auto_confirm_perfect_matches = false,
  } = options;

  console.log('🔍 Starting Level 1: Direct/Exact Matching...');

  const matches: DirectMatchResult[] = [];
  let autoConfirmedCount = 0;

  await transaction(async (client: PoolClient) => {
    // Fetch unmatched invoices (unpaid or partially paid)
    const invoices = await fetchUnmatchedInvoices(client, invoice_ids);
    console.log(`   Found ${invoices.length} unpaid/partially paid invoices`);

    // Fetch unmatched payments (exclude auto-reconciled)
    const payments = await fetchUnmatchedPayments(
      client,
      payment_ids,
      exclude_auto_reconciled
    );
    console.log(`   Found ${payments.length} unmatched payments`);

    // Process each payment through matching algorithms
    for (const payment of payments) {
      const paymentMatches = await findMatchesForPayment(
        client,
        payment,
        invoices,
        auto_confirm_perfect_matches
      );

      matches.push(...paymentMatches);

      // Count auto-confirmed matches
      autoConfirmedCount += paymentMatches.filter(
        (m) => m.match_type === 'perfect_match' && !m.requires_review
      ).length;
    }
  });

  // Calculate summary statistics
  const byType: Record<string, number> = {};
  matches.forEach((match) => {
    byType[match.match_type] = (byType[match.match_type] || 0) + 1;
  });

  const requiresReviewCount = matches.filter((m) => m.requires_review).length;

  console.log(`✅ Direct matching complete: ${matches.length} matches found`);
  console.log(`   - Auto-confirmed: ${autoConfirmedCount}`);
  console.log(`   - Requires review: ${requiresReviewCount}`);

  return {
    total_matches: matches.length,
    by_type: byType,
    auto_confirmed: autoConfirmedCount,
    requires_review: requiresReviewCount,
    matches,
  };
}

/**
 * Find matches for a single payment
 *
 * Applies matching rules in priority order:
 * 1. Perfect Match
 * 2. Partial Payment
 * 3. Overpayment
 * 4. High Confidence Single Match
 * 5. Exact Amount with Payer Match
 *
 * @param client Database client
 * @param payment Payment to match
 * @param invoices Available invoices
 * @param autoConfirmPerfect Auto-confirm perfect matches
 * @returns Array of matches found
 */
async function findMatchesForPayment(
  client: PoolClient,
  payment: Payment,
  invoices: Invoice[],
  autoConfirmPerfect: boolean
): Promise<DirectMatchResult[]> {
  const matches: DirectMatchResult[] = [];

  // Extract invoice numbers from payment description
  const invoiceNumbersInDescription = extractInvoiceNumbers(payment.description);

  // RULE 1: Perfect Match (100% confidence)
  if (invoiceNumbersInDescription.length > 0) {
    for (const invoiceNumber of invoiceNumbersInDescription) {
      const invoice = invoices.find((inv) => inv.invoice_number === invoiceNumber);

      if (invoice && amountsEqual(payment.amount, invoice.outstanding_amount)) {
        // Perfect match found!
        const match = await createMatch(client, {
          payment,
          invoice,
          matchType: 'perfect_match',
          confidence: 100,
          amountMatched: payment.amount,
          requiresReview: !autoConfirmPerfect,
          reason: 'Invoice number and exact amount match',
          matchedFields: ['invoice_number', 'amount'],
        });

        matches.push(match);

        // Update invoice for perfect match (if auto-confirmed)
        if (autoConfirmPerfect) {
          await updateInvoiceAfterMatch(client, invoice.id, payment.amount, 'fully_paid');
        }

        // Stop processing for this payment (perfect match found)
        return matches;
      }
    }
  }

  // RULE 2: Partial Payment Detection (95% confidence)
  if (invoiceNumbersInDescription.length > 0) {
    for (const invoiceNumber of invoiceNumbersInDescription) {
      const invoice = invoices.find((inv) => inv.invoice_number === invoiceNumber);

      if (invoice && isPartialPayment(payment.amount, invoice.outstanding_amount)) {
        // Validate: description contains payee or patient name
        const nameMatch = descriptionContainsName(
          payment.description,
          invoice.payee_name,
          invoice.patient_name,
          80
        );

        if (nameMatch.matched) {
          const match = await createMatch(client, {
            payment,
            invoice,
            matchType: 'partial_payment',
            confidence: 95,
            amountMatched: payment.amount,
            requiresReview: true,
            reason: `Partial payment: $${payment.amount} of $${invoice.outstanding_amount} outstanding`,
            matchedFields: ['invoice_number', nameMatch.matchedField || 'name'],
            nameSimilarity: nameMatch.score,
          });

          matches.push(match);

          // Update invoice for partial payment
          await updateInvoiceAfterMatch(
            client,
            invoice.id,
            payment.amount,
            'partially_paid'
          );

          return matches;
        }
      }
    }
  }

  // RULE 3: Overpayment Detection (90% confidence)
  if (invoiceNumbersInDescription.length > 0) {
    for (const invoiceNumber of invoiceNumbersInDescription) {
      const invoice = invoices.find((inv) => inv.invoice_number === invoiceNumber);

      if (invoice && isOverpayment(payment.amount, invoice.outstanding_amount)) {
        // Validate: description contains payee or patient name
        const nameMatch = descriptionContainsName(
          payment.description,
          invoice.payee_name,
          invoice.patient_name,
          80
        );

        if (nameMatch.matched) {
          const overpaymentAmount = calculateOverpayment(
            payment.amount,
            invoice.outstanding_amount
          );

          const match = await createMatch(client, {
            payment,
            invoice,
            matchType: 'overpaid',
            confidence: 90,
            amountMatched: invoice.outstanding_amount, // Only match outstanding amount
            requiresReview: true,
            reason: `Payment exceeds invoice amount by $${overpaymentAmount}`,
            matchedFields: ['invoice_number', nameMatch.matchedField || 'name'],
            nameSimilarity: nameMatch.score,
            amountDifference: overpaymentAmount,
          });

          matches.push(match);

          // DO NOT auto-update invoice (requires user decision)
          return matches;
        }
      }
    }
  }

  // RULE 4: High Confidence Single Match (90% confidence)
  // NO invoice number in description
  if (invoiceNumbersInDescription.length === 0) {
    // Find invoices with exact amount match
    const exactAmountInvoices = invoices.filter((inv) =>
      amountsEqual(payment.amount, inv.outstanding_amount)
    );

    for (const invoice of exactAmountInvoices) {
      const nameMatch = descriptionContainsName(
        payment.description,
        invoice.payee_name,
        invoice.patient_name,
        80
      );

      if (nameMatch.matched) {
        // Check if this is the ONLY unpaid invoice for this payee/patient with this amount
        const matchingInvoices = invoices.filter(
          (inv) =>
            amountsEqual(payment.amount, inv.outstanding_amount) &&
            (fuzzyNameMatch(payment.description, inv.payee_name) >= 80 ||
              fuzzyNameMatch(payment.description, inv.patient_name) >= 80)
        );

        if (matchingInvoices.length === 1) {
          const match = await createMatch(client, {
            payment,
            invoice,
            matchType: 'high_confidence_match',
            confidence: 90,
            amountMatched: payment.amount,
            requiresReview: true,
            reason: 'Single invoice found with exact amount and name match',
            matchedFields: ['amount', nameMatch.matchedField || 'name'],
            nameSimilarity: nameMatch.score,
          });

          matches.push(match);
          return matches;
        }
      }
    }
  }

  // RULE 5: Exact Amount with Payer Match (85% confidence)
  // NO invoice number, exact amount, multiple invoices possible
  if (invoiceNumbersInDescription.length === 0) {
    const exactAmountInvoices = invoices.filter((inv) =>
      amountsEqual(payment.amount, inv.outstanding_amount)
    );

    for (const invoice of exactAmountInvoices) {
      // Check payer name match (normalized)
      const payeeScore = fuzzyNameMatch(payment.description, invoice.payee_name);
      const patientScore = fuzzyNameMatch(payment.description, invoice.patient_name);

      if (payeeScore >= 80 || patientScore >= 80) {
        const bestScore = Math.max(payeeScore, patientScore);
        const matchedField = payeeScore >= patientScore ? 'payee' : 'patient';

        const match = await createMatch(client, {
          payment,
          invoice,
          matchType: 'exact_amount_payer',
          confidence: 85,
          amountMatched: payment.amount,
          requiresReview: true,
          reason: 'Exact amount match with payer name similarity',
          matchedFields: ['amount', matchedField],
          nameSimilarity: bestScore,
        });

        matches.push(match);
        // Continue checking other invoices (multiple matches possible)
      }
    }
  }

  return matches;
}

/**
 * Create a match record in the database
 */
async function createMatch(
  client: PoolClient,
  params: {
    payment: Payment;
    invoice: Invoice;
    matchType: string;
    confidence: number;
    amountMatched: number;
    requiresReview: boolean;
    reason: string;
    matchedFields: string[];
    nameSimilarity?: number;
    amountDifference?: number;
  }
): Promise<DirectMatchResult> {
  const {
    payment,
    invoice,
    matchType,
    confidence,
    amountMatched,
    requiresReview,
    reason,
    matchedFields,
    nameSimilarity,
    amountDifference,
  } = params;

  // Check for duplicate matches
  const duplicateCheck = await client.query(
    `SELECT id FROM matches
     WHERE payment_id = $1 AND invoice_id = $2 AND status != 'rejected'`,
    [payment.id, invoice.id]
  );

  if (duplicateCheck.rows.length > 0) {
    console.log(
      `   ⚠️  Duplicate match detected: Payment ${payment.id} + Invoice ${invoice.invoice_number}`
    );
    // Return existing match
    return {
      match_id: duplicateCheck.rows[0].id,
      payment_id: payment.id,
      invoice_id: invoice.id,
      match_type: matchType as any,
      confidence,
      amount_matched: amountMatched,
      requires_review: requiresReview,
      details: {
        reason,
        matched_fields: matchedFields,
        name_similarity: nameSimilarity,
        amount_difference: amountDifference,
      },
    };
  }

  // Insert match record
  const insertQuery = `
    INSERT INTO matches (
      payment_id,
      invoice_id,
      match_type,
      match_confidence,
      amount_matched,
      status,
      matched_by,
      notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `;

  const status = requiresReview ? 'pending' : 'confirmed';
  const notes = JSON.stringify({
    reason,
    matched_fields: matchedFields,
    name_similarity: nameSimilarity,
    amount_difference: amountDifference,
  });

  const result = await client.query(insertQuery, [
    payment.id,
    invoice.id,
    matchType,
    confidence,
    amountMatched,
    status,
    'system',
    notes,
  ]);

  console.log(
    `   ✓ ${matchType} (${confidence}%): Payment $${payment.amount} → Invoice ${invoice.invoice_number}`
  );

  return {
    match_id: result.rows[0].id,
    payment_id: payment.id,
    invoice_id: invoice.id,
    match_type: matchType as any,
    confidence,
    amount_matched: amountMatched,
    requires_review: requiresReview,
    details: {
      reason,
      matched_fields: matchedFields,
      name_similarity: nameSimilarity,
      amount_difference: amountDifference,
    },
  };
}

/**
 * Update invoice after successful match
 */
async function updateInvoiceAfterMatch(
  client: PoolClient,
  invoiceId: string,
  paymentAmount: number,
  newStatus: 'partially_paid' | 'fully_paid'
): Promise<void> {
  // Get current invoice
  const invoiceResult = await client.query(
    `SELECT outstanding_amount FROM invoices WHERE id = $1`,
    [invoiceId]
  );

  if (invoiceResult.rows.length === 0) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  const currentOutstanding = invoiceResult.rows[0].outstanding_amount;
  const newOutstanding =
    newStatus === 'fully_paid' ? 0 : currentOutstanding - paymentAmount;

  await client.query(
    `UPDATE invoices
     SET outstanding_amount = $1,
         status = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [newOutstanding, newStatus, invoiceId]
  );
}

/**
 * Fetch unmatched invoices (unpaid or partially paid)
 */
async function fetchUnmatchedInvoices(
  client: PoolClient,
  invoiceIds?: string[]
): Promise<Invoice[]> {
  let queryText = `
    SELECT id, invoice_number, invoice_date, patient_name, payee_name,
           amount, outstanding_amount, status
    FROM invoices
    WHERE status IN ('unpaid', 'partially_paid')
      AND outstanding_amount > 0
  `;

  const params: any[] = [];

  if (invoiceIds && invoiceIds.length > 0) {
    queryText += ` AND id = ANY($1)`;
    params.push(invoiceIds);
  }

  queryText += ` ORDER BY invoice_date DESC`;

  const result = await client.query(queryText, params);
  return result.rows;
}

/**
 * Fetch unmatched payments
 */
async function fetchUnmatchedPayments(
  client: PoolClient,
  paymentIds?: string[],
  excludeAutoReconciled: boolean = true
): Promise<Payment[]> {
  let queryText = `
    SELECT id, payment_date, amount, description,
           auto_reconciled, auto_reconciled_source, status
    FROM payments
    WHERE status = 'unmatched'
  `;

  const params: any[] = [];

  if (excludeAutoReconciled) {
    queryText += ` AND auto_reconciled = FALSE`;
  }

  if (paymentIds && paymentIds.length > 0) {
    queryText += ` AND id = ANY($${params.length + 1})`;
    params.push(paymentIds);
  }

  queryText += ` ORDER BY payment_date DESC`;

  const result = await client.query(queryText, params);
  return result.rows;
}
