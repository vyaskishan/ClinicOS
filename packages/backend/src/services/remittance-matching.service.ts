import { PoolClient } from 'pg';
import { transaction } from '../config/database';
import { amountsEqual, fuzzyNameMatch } from '../utils/matching.utils';

/**
 * REMITTANCE-PAYMENT MATCHING SERVICE
 *
 * Purpose: Match remittance advice documents to bank payments using priority-based algorithm.
 *
 * Priority Matching:
 * 1. Payment Code Match (95% confidence) - CRITICAL: Match by payment reference code
 * 2. Date + Amount + Payer (85% confidence) - Match by date window, amount, and payer name
 * 3. Amount + Payer Only (75% confidence) - Match by amount and payer name (no date)
 *
 * After matching remittance to payment, links all invoice line items in the remittance
 * to create remittance-assisted invoice-payment matches.
 */

export interface RemittanceMatchResult {
  remittance_id: string;
  payment_id: string;
  match_type: 'payment_code_match' | 'date_amount_payer' | 'amount_payer';
  confidence: number;
  matched_by: string[];
  details: {
    payment_code_match?: boolean;
    date_difference_days?: number;
    amount_difference?: number;
    payer_similarity?: number;
  };
}

export interface RemittanceMatchingSummary {
  total_remittances: number;
  matched_remittances: number;
  unmatched_remittances: number;
  by_match_type: Record<string, number>;
  invoice_matches_created: number;
  matches: RemittanceMatchResult[];
}

/**
 * Run remittance-payment matching algorithm
 *
 * @param options Matching options
 * @returns Summary of matches created
 */
export async function matchRemittancesToPayments(options?: {
  remittance_ids?: string[];
  payment_ids?: string[];
}): Promise<RemittanceMatchingSummary> {
  const { remittance_ids, payment_ids } = options || {};

  console.log('🔗 Starting Remittance-Payment Matching...');

  const matches: RemittanceMatchResult[] = [];
  let invoiceMatchesCreated = 0;

  await transaction(async (client: PoolClient) => {
    // Fetch unmatched remittances
    const remittances = await fetchUnmatchedRemittances(client, remittance_ids);
    console.log(`   Found ${remittances.length} unmatched remittance(s)`);

    // Fetch unmatched payments (exclude auto-reconciled)
    const payments = await fetchUnmatchedPayments(client, payment_ids);
    console.log(`   Found ${payments.length} unmatched payment(s)`);

    // Match each remittance
    for (const remittance of remittances) {
      const match = await findPaymentForRemittance(client, remittance, payments);

      if (match) {
        matches.push(match);

        // Create invoice-payment matches for all line items
        const invoiceCount = await createInvoiceMatchesFromRemittance(
          client,
          remittance,
          match.payment_id
        );

        invoiceMatchesCreated += invoiceCount;

        console.log(
          `   ✓ Matched remittance ${remittance.id} → Payment (${match.match_type}, ${match.confidence}%)`
        );
        console.log(`     Created ${invoiceCount} invoice-payment matches`);
      } else {
        console.log(`   ✗ No match found for remittance ${remittance.id}`);
      }
    }
  });

  // Calculate summary
  const byType: Record<string, number> = {};
  matches.forEach((m) => {
    byType[m.match_type] = (byType[m.match_type] || 0) + 1;
  });

  console.log(`✅ Remittance matching complete: ${matches.length} remittances matched`);
  console.log(`   Created ${invoiceMatchesCreated} invoice-payment matches`);

  return {
    total_remittances: matches.length,
    matched_remittances: matches.length,
    unmatched_remittances: 0,
    by_match_type: byType,
    invoice_matches_created: invoiceMatchesCreated,
    matches,
  };
}

/**
 * Find payment match for a single remittance
 *
 * Priority order:
 * 1. Payment code match (95%)
 * 2. Date + Amount + Payer (85%)
 * 3. Amount + Payer only (75%)
 */
async function findPaymentForRemittance(
  client: PoolClient,
  remittance: any,
  payments: any[]
): Promise<RemittanceMatchResult | null> {
  // PRIORITY 1: Payment Code Match (95% confidence)
  if (remittance.payment_code) {
    for (const payment of payments) {
      // Check if payment description contains the payment code
      if (payment.description.includes(remittance.payment_code)) {
        // Validate: amount matches (within $1)
        if (
          remittance.total_amount &&
          Math.abs(payment.amount - remittance.total_amount) <= 1.0
        ) {
          // Mark payment as matched
          await updatePaymentStatus(client, payment.id, 'matched');

          return {
            remittance_id: remittance.id,
            payment_id: payment.id,
            match_type: 'payment_code_match',
            confidence: 95,
            matched_by: ['payment_code', 'amount'],
            details: {
              payment_code_match: true,
              amount_difference: Math.abs(payment.amount - remittance.total_amount),
            },
          };
        }
      }
    }
  }

  // PRIORITY 2: Date + Amount + Payer (85% confidence)
  if (remittance.remittance_date && remittance.total_amount && remittance.payer_name) {
    const remittanceDate = new Date(remittance.remittance_date);

    for (const payment of payments) {
      const paymentDate = new Date(payment.payment_date);
      const daysDifference = Math.abs(
        (paymentDate.getTime() - remittanceDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check date within ±3 days
      if (daysDifference <= 3) {
        // Check amount match (within $1)
        if (Math.abs(payment.amount - remittance.total_amount) <= 1.0) {
          // Check payer name match (fuzzy >80%)
          const payerSimilarity = fuzzyNameMatch(payment.description, remittance.payer_name);

          if (payerSimilarity >= 80) {
            // Mark payment as matched
            await updatePaymentStatus(client, payment.id, 'matched');

            return {
              remittance_id: remittance.id,
              payment_id: payment.id,
              match_type: 'date_amount_payer',
              confidence: 85,
              matched_by: ['date', 'amount', 'payer'],
              details: {
                date_difference_days: Math.round(daysDifference),
                amount_difference: Math.abs(payment.amount - remittance.total_amount),
                payer_similarity: payerSimilarity,
              },
            };
          }
        }
      }
    }
  }

  // PRIORITY 3: Amount + Payer Only (75% confidence)
  if (remittance.total_amount && remittance.payer_name) {
    for (const payment of payments) {
      // Check amount match (within $1)
      if (Math.abs(payment.amount - remittance.total_amount) <= 1.0) {
        // Check payer name match (fuzzy >80%)
        const payerSimilarity = fuzzyNameMatch(payment.description, remittance.payer_name);

        if (payerSimilarity >= 80) {
          // Mark payment as matched
          await updatePaymentStatus(client, payment.id, 'matched');

          return {
            remittance_id: remittance.id,
            payment_id: payment.id,
            match_type: 'amount_payer',
            confidence: 75,
            matched_by: ['amount', 'payer'],
            details: {
              amount_difference: Math.abs(payment.amount - remittance.total_amount),
              payer_similarity: payerSimilarity,
            },
          };
        }
      }
    }
  }

  return null;
}

/**
 * Create invoice-payment matches from remittance line items
 *
 * Links all invoices listed in the remittance to the matched payment.
 * This is "remittance-assisted" matching.
 */
async function createInvoiceMatchesFromRemittance(
  client: PoolClient,
  remittance: any,
  paymentId: string
): Promise<number> {
  let matchesCreated = 0;

  // Parse line items from parsed_content JSONB
  const lineItems = remittance.parsed_content?.line_items || [];

  for (const item of lineItems) {
    // Find invoice by invoice number
    const invoiceResult = await client.query(
      `SELECT id, outstanding_amount, status FROM invoices WHERE invoice_number = $1`,
      [item.invoice_number]
    );

    if (invoiceResult.rows.length === 0) {
      console.log(`     ⚠️  Invoice ${item.invoice_number} not found in database`);
      continue;
    }

    const invoice = invoiceResult.rows[0];

    // Check for duplicate match
    const duplicateCheck = await client.query(
      `SELECT id FROM matches WHERE payment_id = $1 AND invoice_id = $2 AND status != 'rejected'`,
      [paymentId, invoice.id]
    );

    if (duplicateCheck.rows.length > 0) {
      console.log(`     ⚠️  Match already exists for invoice ${item.invoice_number}`);
      continue;
    }

    // Create match record
    const insertMatch = `
      INSERT INTO matches (
        payment_id,
        invoice_id,
        remittance_id,
        match_type,
        match_confidence,
        amount_matched,
        status,
        matched_by,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    const notes = JSON.stringify({
      reason: 'Remittance-assisted match',
      line_item: item,
      remittance_file: remittance.file_name,
    });

    await client.query(insertMatch, [
      paymentId,
      invoice.id,
      remittance.id,
      'remittance_assisted',
      90, // High confidence for remittance-assisted matches
      item.amount,
      'pending', // Requires review
      'system',
      notes,
    ]);

    matchesCreated++;

    // Update invoice status if amount matches
    if (amountsEqual(item.amount, invoice.outstanding_amount)) {
      await client.query(
        `UPDATE invoices
         SET status = 'fully_paid',
             outstanding_amount = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [invoice.id]
      );
    } else if (item.amount < invoice.outstanding_amount) {
      const newOutstanding = invoice.outstanding_amount - item.amount;
      await client.query(
        `UPDATE invoices
         SET status = 'partially_paid',
             outstanding_amount = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newOutstanding, invoice.id]
      );
    }
  }

  return matchesCreated;
}

/**
 * Fetch unmatched remittances
 */
async function fetchUnmatchedRemittances(
  client: PoolClient,
  remittanceIds?: string[]
): Promise<any[]> {
  let queryText = `
    SELECT r.*, COUNT(m.id) as match_count
    FROM remittances r
    LEFT JOIN matches m ON m.remittance_id = r.id AND m.status != 'rejected'
    WHERE r.total_amount IS NOT NULL
  `;

  const params: any[] = [];

  if (remittanceIds && remittanceIds.length > 0) {
    queryText += ` AND r.id = ANY($1)`;
    params.push(remittanceIds);
  }

  queryText += `
    GROUP BY r.id
    HAVING COUNT(m.id) = 0
    ORDER BY r.remittance_date DESC
  `;

  const result = await client.query(queryText, params);
  return result.rows;
}

/**
 * Fetch unmatched payments
 */
async function fetchUnmatchedPayments(
  client: PoolClient,
  paymentIds?: string[]
): Promise<any[]> {
  let queryText = `
    SELECT id, payment_date, amount, description, status
    FROM payments
    WHERE status = 'unmatched'
      AND auto_reconciled = FALSE
  `;

  const params: any[] = [];

  if (paymentIds && paymentIds.length > 0) {
    queryText += ` AND id = ANY($1)`;
    params.push(paymentIds);
  }

  queryText += ` ORDER BY payment_date DESC`;

  const result = await client.query(queryText, params);
  return result.rows;
}

/**
 * Update payment status
 */
async function updatePaymentStatus(
  client: PoolClient,
  paymentId: string,
  status: string
): Promise<void> {
  await client.query(
    `UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [status, paymentId]
  );
}
