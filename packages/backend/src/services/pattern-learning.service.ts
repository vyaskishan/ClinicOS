/**
 * PATTERN LEARNING SERVICE
 *
 * Purpose: Machine learning service that learns from manual matches.
 *
 * This service:
 * 1. Extracts patterns when users create manual matches
 * 2. Stores patterns in manual_match_patterns table
 * 3. Finds existing similar patterns to avoid duplicates
 * 4. Tracks pattern usage and success rates
 * 5. Applies patterns during automated matching
 *
 * Security: No PHI logging. Patterns are generic identifiers only.
 */

import { PoolClient } from 'pg';
import {
  extractPattern,
  matchPattern,
  calculateSuccessRate,
  calculateEffectiveBoost,
  shouldReviewPattern,
} from '../utils/pattern-extraction.utils';
import * as fuzzball from 'fuzzball';

/**
 * Pattern stored in database
 */
export interface StoredPattern {
  id: string;
  bank_description_pattern: string;
  payee_name: string | null;
  patient_name: string | null;
  match_confidence_boost: number;
  times_used: number;
  success_rate: number;
  created_from_match_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Pattern match result (when finding patterns for a payment)
 */
export interface PatternMatchResult {
  pattern: StoredPattern;
  matchScore: number; // 0-100, how well pattern matches payment
  effectiveBoost: number; // Actual boost to apply (scaled by success rate)
}

/**
 * Learn pattern from a manual match.
 *
 * This is called when a user manually matches a payment to an invoice.
 * It extracts patterns from the payment description and stores them for future use.
 *
 * @param client Database client
 * @param paymentDescription Bank feed description
 * @param invoicePayeeName Payee name from matched invoice
 * @param invoicePatientName Patient name from matched invoice (optional)
 * @param matchId ID of the manual match record
 * @returns Created or updated pattern
 */
export async function learnPatternFromMatch(
  client: PoolClient,
  paymentDescription: string,
  invoicePayeeName: string,
  invoicePatientName: string | null,
  matchId: string
): Promise<StoredPattern | null> {
  try {
    // 1. Extract pattern from payment description
    const pattern = extractPattern(paymentDescription, invoicePayeeName, invoicePatientName || undefined);

    // Skip if pattern confidence is too low (< 40%)
    if (pattern.confidence < 40) {
      console.log(
        `[PatternLearning] Skipping low-confidence pattern (${pattern.confidence}%) for: "${paymentDescription}"`
      );
      return null;
    }

    // Skip if combined pattern is empty
    if (!pattern.combinedPattern || pattern.combinedPattern.trim().length === 0) {
      console.log(`[PatternLearning] Skipping empty pattern for: "${paymentDescription}"`);
      return null;
    }

    // 2. Check if similar pattern already exists
    const existingPattern = await findSimilarPattern(
      client,
      pattern.combinedPattern,
      invoicePayeeName
    );

    if (existingPattern) {
      // Update existing pattern (just timestamp, don't increment times_used yet)
      console.log(
        `[PatternLearning] Found existing pattern "${existingPattern.bank_description_pattern}" - no update needed`
      );
      return existingPattern;
    }

    // 3. Create new pattern
    const newPattern = await createPattern(
      client,
      pattern.combinedPattern,
      invoicePayeeName,
      invoicePatientName,
      10.0, // Default confidence boost
      matchId
    );

    console.log(
      `[PatternLearning] Created new pattern: "${newPattern.bank_description_pattern}" → "${newPattern.payee_name}"`
    );

    return newPattern;
  } catch (error) {
    console.error('[PatternLearning] Error learning pattern:', error);
    throw error;
  }
}

/**
 * Find existing pattern similar to the new pattern.
 *
 * Uses fuzzy matching to avoid creating duplicate patterns.
 *
 * @param client Database client
 * @param patternString Pattern to search for
 * @param payeeName Payee name to match
 * @returns Existing pattern or null
 */
async function findSimilarPattern(
  client: PoolClient,
  patternString: string,
  payeeName: string
): Promise<StoredPattern | null> {
  try {
    // Query patterns with same payee name
    const result = await client.query<StoredPattern>(
      `
      SELECT *
      FROM manual_match_patterns
      WHERE payee_name = $1
      ORDER BY created_at DESC
      LIMIT 20
    `,
      [payeeName]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // Use fuzzy matching to find similar pattern
    let bestMatch: StoredPattern | null = null;
    let bestSimilarity = 0;

    result.rows.forEach((pattern) => {
      const similarity = fuzzball.token_sort_ratio(
        patternString.toLowerCase(),
        pattern.bank_description_pattern.toLowerCase()
      );

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = pattern;
      }
    });

    // Threshold: 80% similarity to consider it the same pattern
    if (bestSimilarity >= 80) {
      return bestMatch;
    }

    return null;
  } catch (error) {
    console.error('[PatternLearning] Error finding similar pattern:', error);
    throw error;
  }
}

/**
 * Create a new pattern in the database.
 *
 * @param client Database client
 * @param patternString Extracted pattern string
 * @param payeeName Payee name
 * @param patientName Patient name (optional)
 * @param confidenceBoost Boost to apply (default: 10.0)
 * @param matchId Match ID that created this pattern
 * @returns Created pattern
 */
async function createPattern(
  client: PoolClient,
  patternString: string,
  payeeName: string,
  patientName: string | null,
  confidenceBoost: number,
  matchId: string
): Promise<StoredPattern> {
  try {
    const result = await client.query<StoredPattern>(
      `
      INSERT INTO manual_match_patterns (
        bank_description_pattern,
        payee_name,
        patient_name,
        match_confidence_boost,
        times_used,
        success_rate,
        created_from_match_id
      ) VALUES ($1, $2, $3, $4, 0, 100.00, $5)
      RETURNING *
    `,
      [patternString, payeeName, patientName, confidenceBoost, matchId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('[PatternLearning] Error creating pattern:', error);
    throw error;
  }
}

/**
 * Find patterns that match a payment description.
 *
 * This is called during fuzzy matching to boost scores based on learned patterns.
 *
 * @param client Database client
 * @param paymentDescription Payment description to match
 * @param invoicePayeeName Payee name from invoice being matched
 * @returns Array of matching patterns with scores
 */
export async function findMatchingPatterns(
  client: PoolClient,
  paymentDescription: string,
  invoicePayeeName: string
): Promise<PatternMatchResult[]> {
  try {
    // Query patterns for this payee
    const result = await client.query<StoredPattern>(
      `
      SELECT *
      FROM manual_match_patterns
      WHERE payee_name = $1
      ORDER BY success_rate DESC, times_used DESC
      LIMIT 50
    `,
      [invoicePayeeName]
    );

    if (result.rows.length === 0) {
      return [];
    }

    const matches: PatternMatchResult[] = [];

    // Check each pattern for match
    result.rows.forEach((pattern) => {
      const matchScore = matchPattern(paymentDescription, pattern.bank_description_pattern);

      // Only include if match score >= 60%
      if (matchScore >= 60) {
        const effectiveBoost = calculateEffectiveBoost(
          pattern.match_confidence_boost,
          pattern.success_rate,
          pattern.times_used
        );

        matches.push({
          pattern,
          matchScore,
          effectiveBoost,
        });
      }
    });

    // Sort by effective boost (highest first)
    matches.sort((a, b) => b.effectiveBoost - a.effectiveBoost);

    return matches;
  } catch (error) {
    console.error('[PatternLearning] Error finding matching patterns:', error);
    throw error;
  }
}

/**
 * Get the best pattern boost for a payment-invoice pair.
 *
 * This is the main function called during fuzzy matching.
 *
 * @param client Database client
 * @param paymentDescription Payment description
 * @param invoicePayeeName Payee name from invoice
 * @returns Best boost to apply (0-100)
 */
export async function getBestPatternBoost(
  client: PoolClient,
  paymentDescription: string,
  invoicePayeeName: string
): Promise<{ boost: number; patternId: string | null; matchScore: number }> {
  try {
    const matches = await findMatchingPatterns(client, paymentDescription, invoicePayeeName);

    if (matches.length === 0) {
      return { boost: 0, patternId: null, matchScore: 0 };
    }

    // Return the highest boost
    const best = matches[0];

    return {
      boost: best.effectiveBoost,
      patternId: best.pattern.id,
      matchScore: best.matchScore,
    };
  } catch (error) {
    console.error('[PatternLearning] Error getting pattern boost:', error);
    return { boost: 0, patternId: null, matchScore: 0 };
  }
}

/**
 * Record that a pattern was used in a match.
 *
 * This increments times_used for the pattern.
 * Called when fuzzy matching applies a pattern boost.
 *
 * @param client Database client
 * @param patternId Pattern ID
 */
export async function recordPatternUsage(client: PoolClient, patternId: string): Promise<void> {
  try {
    await client.query(
      `
      UPDATE manual_match_patterns
      SET times_used = times_used + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
      [patternId]
    );
  } catch (error) {
    console.error('[PatternLearning] Error recording pattern usage:', error);
    throw error;
  }
}

/**
 * Update pattern success rate after a match is confirmed or rejected.
 *
 * Called when user confirms or rejects a match that used a pattern.
 *
 * @param client Database client
 * @param patternId Pattern ID
 * @param wasConfirmed true if user confirmed, false if rejected
 */
export async function updatePatternSuccessRate(
  client: PoolClient,
  patternId: string,
  wasConfirmed: boolean
): Promise<void> {
  try {
    // Get current stats
    const result = await client.query<{ times_used: number; success_rate: number }>(
      `
      SELECT times_used, success_rate
      FROM manual_match_patterns
      WHERE id = $1
    `,
      [patternId]
    );

    if (result.rows.length === 0) {
      return;
    }

    const { times_used, success_rate } = result.rows[0];

    // Calculate new success rate
    // Reverse engineer: confirmed_matches = (success_rate / 100) * times_used
    const currentConfirmedMatches = Math.round((success_rate / 100) * times_used);
    const newConfirmedMatches = wasConfirmed
      ? currentConfirmedMatches + 1
      : currentConfirmedMatches;

    const newSuccessRate = calculateSuccessRate(newConfirmedMatches, times_used);

    // Update pattern
    await client.query(
      `
      UPDATE manual_match_patterns
      SET success_rate = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `,
      [newSuccessRate, patternId]
    );

    console.log(
      `[PatternLearning] Updated pattern ${patternId}: success_rate ${success_rate}% → ${newSuccessRate}%`
    );
  } catch (error) {
    console.error('[PatternLearning] Error updating pattern success rate:', error);
    throw error;
  }
}

/**
 * Get all patterns for management/display.
 *
 * @param client Database client
 * @param filters Optional filters
 * @returns Array of patterns
 */
export async function getAllPatterns(
  client: PoolClient,
  filters?: {
    payeeName?: string;
    minSuccessRate?: number;
    minTimesUsed?: number;
    limit?: number;
    offset?: number;
  }
): Promise<{ patterns: StoredPattern[]; total: number }> {
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.payeeName) {
      conditions.push(`payee_name ILIKE $${paramIndex}`);
      params.push(`%${filters.payeeName}%`);
      paramIndex++;
    }

    if (filters?.minSuccessRate !== undefined) {
      conditions.push(`success_rate >= $${paramIndex}`);
      params.push(filters.minSuccessRate);
      paramIndex++;
    }

    if (filters?.minTimesUsed !== undefined) {
      conditions.push(`times_used >= $${paramIndex}`);
      params.push(filters.minTimesUsed);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM manual_match_patterns ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);

    // Get patterns
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const result = await client.query<StoredPattern>(
      `
      SELECT *
      FROM manual_match_patterns
      ${whereClause}
      ORDER BY success_rate DESC, times_used DESC, created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
      [...params, limit, offset]
    );

    return {
      patterns: result.rows,
      total,
    };
  } catch (error) {
    console.error('[PatternLearning] Error getting all patterns:', error);
    throw error;
  }
}

/**
 * Update a pattern (admin function).
 *
 * @param client Database client
 * @param patternId Pattern ID
 * @param updates Fields to update
 */
export async function updatePattern(
  client: PoolClient,
  patternId: string,
  updates: {
    bank_description_pattern?: string;
    match_confidence_boost?: number;
  }
): Promise<StoredPattern> {
  try {
    const fields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.bank_description_pattern !== undefined) {
      fields.push(`bank_description_pattern = $${paramIndex}`);
      params.push(updates.bank_description_pattern);
      paramIndex++;
    }

    if (updates.match_confidence_boost !== undefined) {
      fields.push(`match_confidence_boost = $${paramIndex}`);
      params.push(updates.match_confidence_boost);
      paramIndex++;
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await client.query<StoredPattern>(
      `
      UPDATE manual_match_patterns
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
      [...params, patternId]
    );

    if (result.rows.length === 0) {
      throw new Error('Pattern not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('[PatternLearning] Error updating pattern:', error);
    throw error;
  }
}

/**
 * Delete a pattern (soft delete - just for cleanup).
 *
 * @param client Database client
 * @param patternId Pattern ID
 */
export async function deletePattern(client: PoolClient, patternId: string): Promise<void> {
  try {
    await client.query(
      `
      DELETE FROM manual_match_patterns
      WHERE id = $1
    `,
      [patternId]
    );

    console.log(`[PatternLearning] Deleted pattern ${patternId}`);
  } catch (error) {
    console.error('[PatternLearning] Error deleting pattern:', error);
    throw error;
  }
}

/**
 * Get pattern suggestions for a specific payment.
 *
 * This helps users understand why certain matches are suggested.
 *
 * @param client Database client
 * @param paymentDescription Payment description
 * @returns Array of suggested patterns with explanations
 */
export async function getPatternSuggestions(
  client: PoolClient,
  paymentDescription: string
): Promise<
  Array<{
    pattern: StoredPattern;
    matchScore: number;
    effectiveBoost: number;
    explanation: string;
  }>
> {
  try {
    // Get all patterns
    const result = await client.query<StoredPattern>(
      `
      SELECT *
      FROM manual_match_patterns
      ORDER BY success_rate DESC, times_used DESC
      LIMIT 100
    `
    );

    const suggestions: Array<{
      pattern: StoredPattern;
      matchScore: number;
      effectiveBoost: number;
      explanation: string;
    }> = [];

    result.rows.forEach((pattern) => {
      const matchScore = matchPattern(paymentDescription, pattern.bank_description_pattern);

      if (matchScore >= 50) {
        // Lower threshold for suggestions
        const effectiveBoost = calculateEffectiveBoost(
          pattern.match_confidence_boost,
          pattern.success_rate,
          pattern.times_used
        );

        let explanation = `Pattern "${pattern.bank_description_pattern}" matches at ${matchScore}%.`;

        if (pattern.times_used > 0) {
          explanation += ` Used ${pattern.times_used} times with ${pattern.success_rate}% success rate.`;
        } else {
          explanation += ` New pattern, not yet used.`;
        }

        if (shouldReviewPattern(pattern.success_rate, pattern.times_used)) {
          explanation += ` ⚠️ Low success rate - may need review.`;
        }

        suggestions.push({
          pattern,
          matchScore,
          effectiveBoost,
          explanation,
        });
      }
    });

    // Sort by match score (highest first)
    suggestions.sort((a, b) => b.matchScore - a.matchScore);

    return suggestions.slice(0, 10); // Top 10 suggestions
  } catch (error) {
    console.error('[PatternLearning] Error getting pattern suggestions:', error);
    throw error;
  }
}
