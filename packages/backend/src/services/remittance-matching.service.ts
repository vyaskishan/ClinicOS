import { PoolClient } from 'pg';
import { transaction } from '../config/database';
import { amountsEqual, fuzzyNameMatch } from '../utils/matching.utils';
import {
  extractEmailDomains,
  extractTransactionIds,
  extractPersonNames,
  hasEmailDomainMatch,
  hasTransactionIdMatch,
} from '../utils/text-extraction.utils';

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
  match_type: 'payment_code_match' | 'email_domain_match' | 'date_amount_payer' | 'amount_payer';
  confidence: number;
  matched_by: string[];
  details: {
    payment_code_match?: boolean;
    email_domain_match?: boolean;
    matched_domain?: string;
    date_difference_days?: number;
    amount_difference?: number;
    payer_similarity?: number;
    patient_similarity?: number;
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
  // PRIORITY 1: Payment Code / Transaction ID Match (95% confidence)
  if (remittance.payment_code) {
    for (const payment of payments) {
      // Extract transaction IDs from payment description
      const paymentTransactionIds = extractTransactionIds(payment.description);

      // Check if payment description contains the payment code OR has matching transaction ID
      const hasCodeMatch =
        payment.description.includes(remittance.payment_code) ||
        hasTransactionIdMatch([remittance.payment_code], paymentTransactionIds);

      if (hasCodeMatch) {
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

  // PRIORITY 1b: Email Domain Match (90% confidence)
  // If remittance has email info and payment description has matching domain
  const remittanceEmailDomains = extractEmailDomains(
    `${remittance.payer_name || ''} ${remittance.file_name || ''}`
  );

  if (remittanceEmailDomains.length > 0) {
    for (const payment of payments) {
      const paymentEmailDomains = extractEmailDomains(payment.description);

      if (hasEmailDomainMatch(remittanceEmailDomains, paymentEmailDomains)) {
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
            match_type: 'email_domain_match',
            confidence: 90,
            matched_by: ['email_domain', 'amount'],
            details: {
              email_domain_match: true,
              matched_domain: remittanceEmailDomains[0],
              amount_difference: Math.abs(payment.amount - remittance.total_amount),
            },
          };
        }
      }
    }
  }

  // PRIORITY 2: Date + Amount + Payer/Patient (85% confidence)
  if (remittance.remittance_date && remittance.total_amount && remittance.payer_name) {
    const remittanceDate = new Date(remittance.remittance_date);

    // Extract patient names from remittance line items
    const remittancePatientNames: string[] = [];
    if (remittance.parsed_content?.line_items) {
      remittance.parsed_content.line_items.forEach((item: any) => {
        if (item.patient_name) {
          remittancePatientNames.push(item.patient_name);
        }
      });
    }

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

          // Also check patient name match if available
          let patientSimilarity = 0;
          if (remittancePatientNames.length > 0) {
            const paymentPersonNames = extractPersonNames(payment.description);
            remittancePatientNames.forEach((remitName) => {
              paymentPersonNames.forEach((payName) => {
                const similarity = fuzzyNameMatch(payName, remitName);
                patientSimilarity = Math.max(patientSimilarity, similarity);
              });
            });
          }

          // Match if payer OR patient similarity is >80%
          const bestSimilarity = Math.max(payerSimilarity, patientSimilarity);

          if (bestSimilarity >= 80) {
            // Mark payment as matched
            await updatePaymentStatus(client, payment.id, 'matched');

            const matchedBy = ['date', 'amount'];
            if (payerSimilarity >= 80) matchedBy.push('payer');
            if (patientSimilarity >= 80) matchedBy.push('patient');

            return {
              remittance_id: remittance.id,
              payment_id: payment.id,
              match_type: 'date_amount_payer',
              confidence: 85,
              matched_by: matchedBy,
              details: {
                date_difference_days: Math.round(daysDifference),
                amount_difference: Math.abs(payment.amount - remittance.total_amount),
                payer_similarity: payerSimilarity,
                patient_similarity: patientSimilarity,
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
 * Handles three scenarios:
 * 1. Bulk Payments: Single payment → multiple invoices (sum matches)
 * 2. Partial Payments: Payment amount < invoice outstanding
 * 3. Distributed Payments: One payment split across multiple invoices
 *
 * This is "remittance-assisted" matching with intelligent amount distribution.
 */
async function createInvoiceMatchesFromRemittance(
  client: PoolClient,
  remittance: any,
  paymentId: string
): Promise<number> {
  let matchesCreated = 0;

  // Parse line items from parsed_content JSONB
  const lineItems = remittance.parsed_content?.line_items || [];

  if (lineItems.length === 0) {
    console.log(`     ⚠️  No line items found in remittance`);
    return 0;
  }

  // Get payment details
  const paymentResult = await client.query(
    `SELECT amount, status FROM payments WHERE id = $1`,
    [paymentId]
  );

  if (paymentResult.rows.length === 0) {
    console.log(`     ⚠️  Payment ${paymentId} not found`);
    return 0;
  }

  const payment = paymentResult.rows[0];
  const paymentAmount = payment.amount;

  // Calculate total from line items
  const lineItemsTotal = lineItems.reduce((sum: number, item: any) => sum + item.amount, 0);

  console.log(`     💰 Payment: $${paymentAmount.toFixed(2)}`);
  console.log(`     📋 Line items total: $${lineItemsTotal.toFixed(2)} (${lineItems.length} items)`);

  // Determine payment scenario
  let scenario: 'bulk' | 'partial' | 'distributed' | 'exact';

  if (lineItems.length > 1 && amountsEqual(lineItemsTotal, paymentAmount)) {
    scenario = 'bulk'; // Bulk: Multiple invoices, sum matches payment
    console.log(`     📦 Scenario: BULK PAYMENT (One-to-Many)`);
  } else if (lineItems.length === 1 && lineItems[0].amount < paymentAmount) {
    scenario = 'partial'; // Partial: Single invoice, payment > amount (rare in remittance)
    console.log(`     📉 Scenario: PARTIAL PAYMENT (overpayment case)`);
  } else if (lineItems.length === 1 && lineItems[0].amount > paymentAmount) {
    scenario = 'partial'; // Partial: Single invoice, payment < amount
    console.log(`     📉 Scenario: PARTIAL PAYMENT`);
  } else if (lineItems.length > 1) {
    scenario = 'distributed'; // Distributed: Multiple invoices, different amounts
    console.log(`     🔀 Scenario: DISTRIBUTED PAYMENT`);
  } else {
    scenario = 'exact'; // Exact: Single invoice, amounts match
    console.log(`     ✅ Scenario: EXACT MATCH`);
  }

  // Process each line item
  for (const item of lineItems) {
    // Find invoice by invoice number
    const invoiceResult = await client.query(
      `SELECT id, amount, outstanding_amount, status FROM invoices WHERE invoice_number = $1`,
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

    // Determine amount to match
    // For distributed/bulk, use the specific amount from remittance
    // For partial, use the lesser of payment amount or outstanding amount
    let amountToMatch = item.amount;

    // Validate amount doesn't exceed invoice outstanding
    if (amountToMatch > invoice.outstanding_amount) {
      console.log(
        `     ⚠️  Line item amount ($${amountToMatch}) exceeds invoice outstanding ($${invoice.outstanding_amount})`
      );
      amountToMatch = invoice.outstanding_amount; // Cap at outstanding
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
      scenario: scenario,
      line_item: item,
      remittance_file: remittance.file_name,
      payment_total: paymentAmount,
      line_items_count: lineItems.length,
    });

    await client.query(insertMatch, [
      paymentId,
      invoice.id,
      remittance.id,
      'remittance_assisted',
      90, // High confidence for remittance-assisted matches
      amountToMatch,
      'pending', // Requires review
      'system',
      notes,
    ]);

    matchesCreated++;

    // Update invoice status based on amount matched
    const newOutstanding = invoice.outstanding_amount - amountToMatch;

    let newStatus: string;
    if (newOutstanding <= 0.01) {
      // Fully paid (within 1 cent tolerance)
      newStatus = 'fully_paid';
      await client.query(
        `UPDATE invoices
         SET status = $1,
             outstanding_amount = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newStatus, invoice.id]
      );
      console.log(
        `     ✓ Invoice ${item.invoice_number}: $${amountToMatch.toFixed(2)} → FULLY PAID`
      );
    } else {
      // Partially paid
      newStatus = 'partially_paid';
      await client.query(
        `UPDATE invoices
         SET status = $1,
             outstanding_amount = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newStatus, newOutstanding, invoice.id]
      );
      console.log(
        `     ✓ Invoice ${item.invoice_number}: $${amountToMatch.toFixed(2)} matched, $${newOutstanding.toFixed(2)} remaining`
      );
    }
  }

  // Update payment status based on scenario
  let paymentStatus: string;
  if (scenario === 'bulk' || scenario === 'distributed' || scenario === 'exact') {
    paymentStatus = 'matched'; // Fully allocated
  } else {
    // Check if payment fully allocated
    const totalMatched = lineItems.reduce((sum: number, item: any) => sum + item.amount, 0);
    paymentStatus = amountsEqual(totalMatched, paymentAmount) ? 'matched' : 'partially_matched';
  }

  await client.query(
    `UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [paymentStatus, paymentId]
  );

  console.log(`     💳 Payment status updated: ${paymentStatus}`);

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
