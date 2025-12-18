import { PoolClient } from 'pg';
import { transaction } from '../config/database';
import * as fuzzball from 'fuzzball';
import {
  extractAllData,
  extractEmailDomains,
  extractTransactionIds,
  extractPersonNames,
  hasTransactionIdMatch,
  hasEmailDomainMatch,
} from '../utils/text-extraction.utils';
import { getBestPatternBoost, recordPatternUsage } from './pattern-learning.service';

/**
 * LEVEL 3: FUZZY MATCHING SERVICE (with Machine Learning Pattern Boost)
 *
 * Purpose: Match unmatched payments to invoices using multi-factor fuzzy matching algorithm
 * with machine learning pattern boost from user-confirmed matches.
 *
 * Scoring Components:
 * 1. Name/Field Similarity (35%) - multi-field matching (payer, patient, email, transaction ID)
 * 2. Amount Similarity (30%) - dynamic tolerance based on amount
 * 3. Date Proximity (20%) - tiered scoring by days difference
 * 4. Pattern Boost (10%) - learned patterns from manual matches
 * 5. Payer Alias Check (5%) - bonus for alias matches
 *
 * Composite Score: 70%+ creates match
 * - 70-85%: pending (manual review required)
 * - >85%: can be auto-confirmed
 *
 * Pattern Learning:
 * - When users manually match payments, system learns patterns
 * - Patterns are applied in future fuzzy matching to boost scores
 * - Pattern effectiveness tracked via success_rate
 */

export interface FuzzyMatchOptions {
  min_confidence?: number; // Minimum score to create match (default: 70)
  auto_confirm_threshold?: number; // Score for auto-confirmation (default: 85)
  payment_ids?: string[]; // Optional: specific payments to match
  invoice_ids?: string[]; // Optional: specific invoices to match
}

export interface FuzzyMatchResult {
  match_id: string;
  payment_id: string;
  invoice_id: string;
  payment_description: string;
  invoice_payee: string;
  payment_amount: number;
  invoice_amount: number;
  payment_date: Date;
  invoice_date: Date;
  confidence: number;
  status: 'pending' | 'confirmed';
  scoring_details: {
    name_similarity: number;
    amount_difference: number;
    date_difference_days: number;
    alias_matched: boolean;
    multi_field_matches: {
      payer_name_match: number;
      patient_name_match: number;
      email_domain_match: boolean;
      transaction_id_match: boolean;
      best_field_matched: string;
    };
    component_scores: {
      name: number;
      amount: number;
      date: number;
      pattern: number;
      alias: number;
    };
    pattern_used: {
      pattern_id: string | null;
      pattern_boost: number;
      pattern_match_score: number;
    };
    total_score: number;
  };
}

export interface FuzzyMatchingSummary {
  total_matches: number;
  pending_review: number;
  auto_confirmed: number;
  score_distribution: {
    '70-75': number;
    '75-80': number;
    '80-85': number;
    '85-90': number;
    '90-95': number;
    '95-100': number;
  };
  matches: FuzzyMatchResult[];
}

/**
 * Run fuzzy matching algorithm
 */
export async function runFuzzyMatching(
  options?: FuzzyMatchOptions
): Promise<FuzzyMatchingSummary> {
  const {
    min_confidence = 70,
    auto_confirm_threshold = 85,
    payment_ids,
    invoice_ids,
  } = options || {};

  console.log('🔍 Starting Level 3: Fuzzy Matching...');
  console.log(`   Min Confidence: ${min_confidence}%`);
  console.log(`   Auto-Confirm Threshold: ${auto_confirm_threshold}%`);

  const matches: FuzzyMatchResult[] = [];

  await transaction(async (client: PoolClient) => {
    // Fetch unmatched payments
    const payments = await fetchUnmatchedPayments(client, payment_ids);
    console.log(`   Found ${payments.length} unmatched payment(s)`);

    // Fetch unmatched invoices
    const invoices = await fetchUnmatchedInvoices(client, invoice_ids);
    console.log(`   Found ${invoices.length} unmatched invoice(s)`);

    // Calculate fuzzy scores for all payment-invoice pairs
    for (const payment of payments) {
      const candidates = await findFuzzyCandidates(
        client,
        payment,
        invoices,
        min_confidence
      );

      // Take the best match for this payment
      if (candidates.length > 0) {
        const bestMatch = candidates[0]; // Already sorted by score descending

        // Determine status based on confidence
        const status =
          bestMatch.confidence >= auto_confirm_threshold ? 'confirmed' : 'pending';

        // Create match record
        const matchId = await createFuzzyMatch(client, bestMatch, status);

        matches.push({
          ...bestMatch,
          match_id: matchId,
          status,
        });

        console.log(
          `   ✓ Match: Payment ${payment.id.substring(0, 8)}... → Invoice ${bestMatch.invoice_id.substring(0, 8)}... (${bestMatch.confidence.toFixed(1)}%)`
        );
      } else {
        console.log(`   ✗ No fuzzy match found for payment ${payment.id.substring(0, 8)}...`);
      }
    }
  });

  // Calculate summary statistics
  const summary = calculateSummary(matches);

  console.log(`✅ Fuzzy matching complete: ${matches.length} matches created`);
  console.log(`   Pending review: ${summary.pending_review}`);
  console.log(`   Auto-confirmed: ${summary.auto_confirmed}`);

  return summary;
}

/**
 * Fetch unmatched payments (status = 'unmatched')
 */
async function fetchUnmatchedPayments(
  client: PoolClient,
  payment_ids?: string[]
): Promise<any[]> {
  let query = `
    SELECT id, description, amount, payment_date, status
    FROM payments
    WHERE status = 'unmatched'
  `;

  const params: any[] = [];

  if (payment_ids && payment_ids.length > 0) {
    query += ` AND id = ANY($1)`;
    params.push(payment_ids);
  }

  query += ` ORDER BY payment_date DESC`;

  const result = await client.query(query, params);
  return result.rows;
}

/**
 * Fetch unmatched invoices (status = 'unpaid')
 */
async function fetchUnmatchedInvoices(
  client: PoolClient,
  invoice_ids?: string[]
): Promise<any[]> {
  let query = `
    SELECT id, invoice_number, payee_name, amount, outstanding_amount, invoice_date, status
    FROM invoices
    WHERE status = 'unpaid'
  `;

  const params: any[] = [];

  if (invoice_ids && invoice_ids.length > 0) {
    query += ` AND id = ANY($1)`;
    params.push(invoice_ids);
  }

  query += ` ORDER BY invoice_date DESC`;

  const result = await client.query(query, params);
  return result.rows;
}

/**
 * Find fuzzy match candidates for a payment
 */
async function findFuzzyCandidates(
  client: PoolClient,
  payment: any,
  invoices: any[],
  min_confidence: number
): Promise<
  Array<
    Omit<FuzzyMatchResult, 'match_id' | 'status'> & {
      invoice_id: string;
      confidence: number;
    }
  >
> {
  const candidates: Array<any> = [];

  for (const invoice of invoices) {
    const score = await calculateFuzzyScore(client, payment, invoice);

    if (score.total_score >= min_confidence) {
      candidates.push({
        payment_id: payment.id,
        invoice_id: invoice.id,
        payment_description: payment.description,
        invoice_payee: invoice.payee_name,
        payment_amount: parseFloat(payment.amount),
        invoice_amount: parseFloat(invoice.amount),
        payment_date: payment.payment_date,
        invoice_date: invoice.invoice_date,
        confidence: score.total_score,
        scoring_details: {
          name_similarity: score.name_similarity,
          amount_difference: score.amount_difference,
          date_difference_days: score.date_difference_days,
          alias_matched: score.alias_matched,
          component_scores: score.component_scores,
          total_score: score.total_score,
        },
      });
    }
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  return candidates;
}

/**
 * Calculate fuzzy score for payment-invoice pair with multi-field matching and pattern boost
 */
async function calculateFuzzyScore(
  client: PoolClient,
  payment: any,
  invoice: any
): Promise<{
  name_similarity: number;
  amount_difference: number;
  date_difference_days: number;
  alias_matched: boolean;
  multi_field_matches: {
    payer_name_match: number;
    patient_name_match: number;
    email_domain_match: boolean;
    transaction_id_match: boolean;
    best_field_matched: string;
  };
  component_scores: {
    name: number;
    amount: number;
    date: number;
    pattern: number;
    alias: number;
  };
  pattern_used: {
    pattern_id: string | null;
    pattern_boost: number;
    pattern_match_score: number;
  };
  total_score: number;
}> {
  // Extract structured data from payment description
  const paymentData = extractAllData(payment.description || '');

  // Extract email domains from invoice fields (if present in payee_name or patient email)
  const invoiceEmailDomains = extractEmailDomains(
    `${invoice.payee_name || ''} ${invoice.patient_email || ''}`
  );

  // Extract transaction IDs from invoice reference fields
  const invoiceTransactionIds = extractTransactionIds(
    `${invoice.invoice_number || ''} ${invoice.reference || ''}`
  );

  // Extract patient names from invoice
  const invoicePatientNames = invoice.patient_name
    ? [invoice.patient_name]
    : extractPersonNames(invoice.notes || '');

  // 1. Multi-Field Name Matching (40% weight)
  // Try matching against multiple fields and use the BEST match

  // 1a. Payer name match (payment description vs invoice payee_name)
  const payerSimilarity = fuzzball.token_sort_ratio(
    payment.description || '',
    invoice.payee_name || ''
  );

  // 1b. Patient name match (extract names from payment description vs invoice patient_name)
  let patientSimilarity = 0;
  if (paymentData.person_names.length > 0 && invoicePatientNames.length > 0) {
    // Compare all extracted patient names
    const similarities: number[] = [];
    paymentData.person_names.forEach((paymentName) => {
      invoicePatientNames.forEach((invoiceName) => {
        similarities.push(fuzzball.token_sort_ratio(paymentName, invoiceName));
      });
    });
    patientSimilarity = Math.max(...similarities, 0);
  }

  // 1c. Email domain match (exact match gives bonus)
  const emailDomainMatch = hasEmailDomainMatch(
    paymentData.email_domains,
    invoiceEmailDomains
  );

  // 1d. Transaction ID match (exact match gives highest bonus)
  const transactionIdMatch = hasTransactionIdMatch(
    paymentData.transaction_ids,
    invoiceTransactionIds
  );

  // Use the BEST matching field
  const nameSimilarity = Math.max(payerSimilarity, patientSimilarity);
  let bestFieldMatched = '';
  if (patientSimilarity > payerSimilarity) {
    bestFieldMatched = 'patient_name';
  } else if (payerSimilarity > 0) {
    bestFieldMatched = 'payer_name';
  }

  // Calculate base name score (35% weight in new formula)
  let nameScore = (nameSimilarity / 100) * 35;

  if (emailDomainMatch) {
    nameScore += 5; // +5 bonus for email domain match
    bestFieldMatched = bestFieldMatched || 'email_domain';
  }

  if (transactionIdMatch) {
    nameScore += 10; // +10 bonus for transaction ID match
    bestFieldMatched = 'transaction_id';
  }

  // Cap at 45 (35 base + 10 transaction bonus)
  nameScore = Math.min(nameScore, 45);

  // 2. Amount Similarity (30% weight)
  const paymentAmount = parseFloat(payment.amount);
  const invoiceAmount = parseFloat(invoice.outstanding_amount || invoice.amount);
  const amountDifference = Math.abs(paymentAmount - invoiceAmount);

  // Dynamic tolerance based on amount
  let tolerance: number;
  if (invoiceAmount < 100) {
    tolerance = 5; // ±$5 for small amounts
  } else if (invoiceAmount <= 1000) {
    tolerance = 10; // ±$10 for medium amounts
  } else {
    tolerance = Math.max(50, invoiceAmount * 0.05); // ±$50 or 5%, whichever is larger
  }

  const amountScore = amountDifference <= tolerance ? 30 : 0;

  // 3. Date Proximity (20% weight)
  const dateDiff = Math.abs(
    Math.floor(
      (new Date(payment.payment_date).getTime() -
        new Date(invoice.invoice_date).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  let datePoints: number;
  if (dateDiff === 0) {
    datePoints = 20;
  } else if (dateDiff <= 7) {
    datePoints = 15;
  } else if (dateDiff <= 14) {
    datePoints = 10;
  } else if (dateDiff <= 30) {
    datePoints = 5;
  } else {
    datePoints = 0;
  }

  // 4. Pattern Boost (10% weight)
  // Get learned pattern boost for this payment-invoice pair
  const patternResult = await getBestPatternBoost(
    client,
    payment.description || '',
    invoice.payee_name || ''
  );

  // Scale pattern boost to max 10 points (10% weight)
  const patternScore = Math.min(patternResult.boost, 10);

  // 5. Payer Alias Check (5% weight)
  const aliasMatched = await checkPayerAlias(
    client,
    payment.description,
    invoice.payee_name
  );
  const aliasScore = aliasMatched ? 5 : 0;

  // Composite Score (updated formula with pattern learning)
  // Formula: (name × 0.35) + (amount × 0.30) + (date × 0.20) + (pattern × 0.10) + (alias × 0.05)
  const totalScore = nameScore + amountScore + datePoints + patternScore + aliasScore;

  return {
    name_similarity: nameSimilarity,
    amount_difference: amountDifference,
    date_difference_days: dateDiff,
    alias_matched: aliasMatched,
    multi_field_matches: {
      payer_name_match: payerSimilarity,
      patient_name_match: patientSimilarity,
      email_domain_match: emailDomainMatch,
      transaction_id_match: transactionIdMatch,
      best_field_matched: bestFieldMatched || 'none',
    },
    component_scores: {
      name: parseFloat(nameScore.toFixed(2)),
      amount: amountScore,
      date: datePoints,
      pattern: parseFloat(patternScore.toFixed(2)),
      alias: aliasScore,
    },
    pattern_used: {
      pattern_id: patternResult.patternId,
      pattern_boost: parseFloat(patternResult.boost.toFixed(2)),
      pattern_match_score: parseFloat(patternResult.matchScore.toFixed(2)),
    },
    total_score: parseFloat(totalScore.toFixed(2)),
  };
}

/**
 * Check if payment description matches any alias for invoice payee
 */
async function checkPayerAlias(
  client: PoolClient,
  paymentDescription: string,
  invoicePayee: string
): Promise<boolean> {
  try {
    // Query payer_aliases table to check if payment description matches any alias
    const result = await client.query(
      `
      SELECT COUNT(*) as count
      FROM payer_aliases
      WHERE canonical_name = $1
      AND LOWER($2) LIKE LOWER('%' || alias || '%')
    `,
      [invoicePayee, paymentDescription]
    );

    return parseInt(result.rows[0].count) > 0;
  } catch (error: any) {
    // If payer_aliases table doesn't exist, return false
    if (error.code === '42P01') {
      return false;
    }
    throw error;
  }
}

/**
 * Create fuzzy match record in database
 */
async function createFuzzyMatch(
  client: PoolClient,
  match: Omit<FuzzyMatchResult, 'match_id' | 'status'>,
  status: 'pending' | 'confirmed'
): Promise<string> {
  const result = await client.query(
    `
    INSERT INTO matches (
      payment_id,
      invoice_id,
      match_type,
      confidence,
      amount_matched,
      status,
      matched_by,
      notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `,
    [
      match.payment_id,
      match.invoice_id,
      'fuzzy',
      match.confidence,
      match.payment_amount,
      status,
      'system',
      JSON.stringify({
        reason: 'Fuzzy matching algorithm',
        scoring_details: match.scoring_details,
        auto_confirmed: status === 'confirmed',
      }),
    ]
  );

  // Record pattern usage if a pattern was used
  if (match.scoring_details.pattern_used.pattern_id) {
    try {
      await recordPatternUsage(client, match.scoring_details.pattern_used.pattern_id);
      console.log(
        `🧠 Recorded pattern usage: ${match.scoring_details.pattern_used.pattern_id} (boost: ${match.scoring_details.pattern_used.pattern_boost})`
      );
    } catch (error) {
      console.error('⚠️ Failed to record pattern usage (non-critical):', error);
    }
  }

  // Update payment status
  await client.query(
    `UPDATE payments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [status === 'confirmed' ? 'matched' : 'partially_matched', match.payment_id]
  );

  // Update invoice status if confirmed
  if (status === 'confirmed') {
    const newOutstanding =
      match.invoice_amount - Math.min(match.payment_amount, match.invoice_amount);

    if (newOutstanding <= 0.01) {
      await client.query(
        `UPDATE invoices
         SET status = 'fully_paid', outstanding_amount = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [match.invoice_id]
      );
    } else {
      await client.query(
        `UPDATE invoices
         SET status = 'partially_paid', outstanding_amount = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newOutstanding, match.invoice_id]
      );
    }
  }

  return result.rows[0].id;
}

/**
 * Calculate summary statistics
 */
function calculateSummary(
  matches: FuzzyMatchResult[]
): FuzzyMatchingSummary {
  const distribution = {
    '70-75': 0,
    '75-80': 0,
    '80-85': 0,
    '85-90': 0,
    '90-95': 0,
    '95-100': 0,
  };

  let pending = 0;
  let confirmed = 0;

  matches.forEach((match) => {
    const score = match.confidence;

    // Count status
    if (match.status === 'confirmed') {
      confirmed++;
    } else {
      pending++;
    }

    // Count distribution
    if (score >= 70 && score < 75) {
      distribution['70-75']++;
    } else if (score >= 75 && score < 80) {
      distribution['75-80']++;
    } else if (score >= 80 && score < 85) {
      distribution['80-85']++;
    } else if (score >= 85 && score < 90) {
      distribution['85-90']++;
    } else if (score >= 90 && score < 95) {
      distribution['90-95']++;
    } else if (score >= 95) {
      distribution['95-100']++;
    }
  });

  return {
    total_matches: matches.length,
    pending_review: pending,
    auto_confirmed: confirmed,
    score_distribution: distribution,
    matches,
  };
}
