/**
 * PATTERN EXTRACTION UTILITIES
 *
 * Purpose: Extract meaningful patterns from bank descriptions for machine learning.
 *
 * This module focuses on identifying key terms and patterns that can be used to
 * match future payments. Unlike text-extraction.utils.ts (which extracts ALL data),
 * this module focuses on extracting LEARNABLE PATTERNS - key identifiers that
 * consistently indicate a specific payer.
 *
 * Examples of good patterns:
 * - "PHAU" → Private Health Australia
 * - "MEDICARE" → Medicare Australia
 * - "DVA" → Department of Veterans Affairs
 * - "MEDIBANK" → Medibank Private
 *
 * Security: No PHI logging - patterns are generic identifiers only.
 */

/**
 * Words to exclude from pattern extraction.
 * These are common banking terms that don't help identify payers.
 */
const PATTERN_NOISE_WORDS = new Set([
  // Banking terms
  'eft', 'bpay', 'payment', 'transfer', 'credit', 'debit', 'deposit', 'withdrawal',
  'direct', 'electronic', 'funds', 'bank', 'banking', 'transaction', 'txn',
  // Generic words
  'the', 'and', 'for', 'from', 'to', 'of', 'in', 'on', 'at', 'by', 'with',
  'ref', 'reference', 'number', 'code', 'id',
  // Medical generic terms (too common to be useful)
  'patient', 'invoice', 'bill', 'claim', 'medical', 'health', 'care',
  'doctor', 'clinic', 'hospital', 'service', 'services',
  // Time-related (changes frequently)
  'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  // Common amounts/numbers (too variable)
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
]);

/**
 * Common organization abbreviations in healthcare.
 * These are high-value patterns worth learning.
 */
const KNOWN_HEALTHCARE_ABBREVIATIONS = [
  'PHAU', 'PHI', 'MC', 'MCARE', 'DVA', 'BUPA', 'NIB', 'HCF', 'MEDIBANK',
  'AHM', 'HIF', 'GMHBA', 'CUA', 'TUH', 'CBHS', 'HBF', 'PEOPLECARE',
  'MEDICARE', 'MEDICAREAUSTRALIA', 'DEPT', 'VETERANS', 'AFFAIRS',
];

/**
 * Pattern extraction result
 */
export interface PatternExtractionResult {
  // Primary patterns (most important)
  abbreviations: string[]; // e.g., ["PHAU", "DVA"]
  organizationKeywords: string[]; // e.g., ["MEDICARE", "AUSTRALIA"]

  // Secondary patterns (supporting info)
  uniqueIdentifiers: string[]; // e.g., ["MCARE2024012001"]
  emailDomains: string[]; // e.g., ["medicare.gov.au"]

  // Combined pattern string (ready to store in DB)
  combinedPattern: string; // e.g., "PHAU | Private Health Australia"

  // Metadata
  confidence: number; // 0-100, how confident we are this is a good pattern
  extractedFrom: string; // Original description (for debugging)
}

/**
 * Extract patterns from bank description.
 *
 * @param description Bank feed description
 * @param payeeName Optional payee name to enhance pattern (from matched invoice)
 * @param patientName Optional patient name (if available)
 * @returns PatternExtractionResult
 */
export function extractPattern(
  description: string,
  payeeName?: string,
  _patientName?: string
): PatternExtractionResult {
  if (!description || description.trim().length === 0) {
    return {
      abbreviations: [],
      organizationKeywords: [],
      uniqueIdentifiers: [],
      emailDomains: [],
      combinedPattern: '',
      confidence: 0,
      extractedFrom: description,
    };
  }

  const abbreviations: string[] = [];
  const organizationKeywords: string[] = [];
  const uniqueIdentifiers: string[] = [];
  const emailDomains: string[] = [];

  // 1. Extract email domains
  const emailPattern = /\b[\w\.-]+@([\w\.-]+\.[a-z]{2,})\b/gi;
  let emailMatch;
  while ((emailMatch = emailPattern.exec(description)) !== null) {
    if (emailMatch[1]) {
      emailDomains.push(emailMatch[1].toLowerCase());
    }
  }

  // 2. Extract known healthcare abbreviations
  const upperDescription = description.toUpperCase();
  KNOWN_HEALTHCARE_ABBREVIATIONS.forEach((abbrev) => {
    // Match as whole word or at start/end
    const abbrPattern = new RegExp(`\\b${abbrev}\\b`, 'i');
    if (abbrPattern.test(description)) {
      abbreviations.push(abbrev);
    }
  });

  // 3. Extract transaction IDs/unique identifiers
  // Pattern 1: After keywords like REF, TXN, ID
  const refPattern = /(?:ref|reference|txn|transaction|id|code|number)[\s:#-]*([A-Z0-9]{6,})/gi;
  let refMatch;
  while ((refMatch = refPattern.exec(description)) !== null) {
    if (refMatch[1]) {
      uniqueIdentifiers.push(refMatch[1].toUpperCase());
    }
  }

  // Pattern 2: Standalone alphanumeric codes
  const standalonePattern = /\b([A-Z]{2,}\d{6,}|\d{6,}[A-Z]{2,}|[A-Z]\d{8,})\b/g;
  let standaloneMatch;
  while ((standaloneMatch = standalonePattern.exec(description)) !== null) {
    const id = standaloneMatch[1].toUpperCase();
    // Avoid duplicates
    if (!uniqueIdentifiers.includes(id)) {
      uniqueIdentifiers.push(id);
    }
  }

  // 4. Extract organization keywords (3+ characters, not noise words)
  const words = description
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((w) => w.length >= 3)
    .map((w) => w.toLowerCase());

  words.forEach((word) => {
    // Skip noise words
    if (PATTERN_NOISE_WORDS.has(word)) {
      return;
    }

    // Skip pure numbers
    if (/^\d+$/.test(word)) {
      return;
    }

    // Check if word appears in payee name (if provided)
    if (payeeName && payeeName.toLowerCase().includes(word)) {
      organizationKeywords.push(word.toUpperCase());
      return;
    }

    // Include if it's ALL CAPS in original (likely important)
    const upperWord = word.toUpperCase();
    if (upperDescription.includes(upperWord) && upperWord.length >= 4) {
      organizationKeywords.push(upperWord);
    }
  });

  // Remove duplicates
  const uniqueAbbreviations = [...new Set(abbreviations)];
  const uniqueOrgKeywords = [...new Set(organizationKeywords)];
  const uniqueIdentifiers_ = [...new Set(uniqueIdentifiers)];
  const uniqueDomains = [...new Set(emailDomains)];

  // 5. Build combined pattern string
  const patternParts: string[] = [];

  if (uniqueAbbreviations.length > 0) {
    patternParts.push(uniqueAbbreviations.join(' '));
  }

  if (uniqueOrgKeywords.length > 0) {
    patternParts.push(uniqueOrgKeywords.slice(0, 3).join(' ')); // Max 3 keywords
  }

  if (payeeName) {
    patternParts.push(`| ${payeeName}`);
  }

  const combinedPattern = patternParts.join(' ').trim();

  // 6. Calculate confidence score
  let confidence = 0;

  // High confidence: Known abbreviations
  if (uniqueAbbreviations.length > 0) {
    confidence += 40;
  }

  // Medium confidence: Email domains
  if (uniqueDomains.length > 0) {
    confidence += 30;
  }

  // Medium confidence: Organization keywords
  if (uniqueOrgKeywords.length > 0) {
    confidence += 20;
  }

  // Low confidence: Unique identifiers (less reusable)
  if (uniqueIdentifiers_.length > 0) {
    confidence += 10;
  }

  // Bonus: Payee name provided (enhances pattern)
  if (payeeName && payeeName.trim().length > 0) {
    confidence += 20;
  }

  // Cap at 100
  confidence = Math.min(confidence, 100);

  return {
    abbreviations: uniqueAbbreviations,
    organizationKeywords: uniqueOrgKeywords,
    uniqueIdentifiers: uniqueIdentifiers_,
    emailDomains: uniqueDomains,
    combinedPattern,
    confidence,
    extractedFrom: description,
  };
}

/**
 * Check if a payment description matches a learned pattern.
 *
 * @param paymentDescription Payment description to check
 * @param learnedPattern Pattern string from database
 * @returns Match score (0-100)
 */
export function matchPattern(paymentDescription: string, learnedPattern: string): number {
  if (!paymentDescription || !learnedPattern) {
    return 0;
  }

  const descUpper = paymentDescription.toUpperCase();
  const patternUpper = learnedPattern.toUpperCase();

  // Split pattern by | (e.g., "PHAU | Private Health Australia")
  const patternParts = patternUpper.split('|').map((p) => p.trim());

  let maxScore = 0;

  patternParts.forEach((part) => {
    if (part.length === 0) {
      return;
    }

    // Exact substring match
    if (descUpper.includes(part)) {
      maxScore = Math.max(maxScore, 100);
      return;
    }

    // Check individual keywords in pattern
    const keywords = part.split(/\s+/).filter((k) => k.length >= 3);

    if (keywords.length === 0) {
      return;
    }

    let matchedKeywords = 0;
    keywords.forEach((keyword) => {
      if (descUpper.includes(keyword)) {
        matchedKeywords++;
      }
    });

    const score = (matchedKeywords / keywords.length) * 100;
    maxScore = Math.max(maxScore, score);
  });

  return maxScore;
}

/**
 * Extract multiple patterns from a description and rank them.
 * Used when we want to find the best pattern to learn.
 *
 * @param description Bank description
 * @param payeeName Payee name from invoice
 * @param patientName Patient name from invoice
 * @returns Array of patterns ranked by confidence
 */
export function extractRankedPatterns(
  description: string,
  payeeName?: string,
  patientName?: string
): PatternExtractionResult[] {
  const patterns: PatternExtractionResult[] = [];

  // Strategy 1: Full pattern extraction
  const fullPattern = extractPattern(description, payeeName, patientName);
  patterns.push(fullPattern);

  // Strategy 2: Abbreviation-only pattern (if abbreviations exist)
  if (fullPattern.abbreviations.length > 0) {
    const abbrevPattern = extractPattern(
      fullPattern.abbreviations.join(' '),
      payeeName,
      patientName
    );
    patterns.push({
      ...abbrevPattern,
      combinedPattern: `${fullPattern.abbreviations.join(' ')} | ${payeeName || ''}`.trim(),
      confidence: Math.min(fullPattern.confidence, 90), // Slightly lower than full
    });
  }

  // Strategy 3: Email domain pattern (if email exists)
  if (fullPattern.emailDomains.length > 0) {
    patterns.push({
      abbreviations: [],
      organizationKeywords: [],
      uniqueIdentifiers: [],
      emailDomains: fullPattern.emailDomains,
      combinedPattern: `${fullPattern.emailDomains[0]} | ${payeeName || ''}`.trim(),
      confidence: 85, // High confidence for email domains
      extractedFrom: description,
    });
  }

  // Sort by confidence (highest first)
  patterns.sort((a, b) => b.confidence - a.confidence);

  return patterns;
}

/**
 * Calculate success rate after a pattern has been used.
 *
 * @param confirmedMatches Number of times pattern led to confirmed match
 * @param totalUses Total number of times pattern was applied
 * @returns Success rate (0-100)
 */
export function calculateSuccessRate(confirmedMatches: number, totalUses: number): number {
  if (totalUses === 0) {
    return 100; // No data yet, assume 100%
  }

  const rate = (confirmedMatches / totalUses) * 100;
  return Math.round(rate * 100) / 100; // Round to 2 decimal places
}

/**
 * Determine if a pattern should be flagged for review or deletion.
 *
 * @param successRate Current success rate (0-100)
 * @param timesUsed How many times pattern has been used
 * @returns true if pattern should be reviewed/deleted
 */
export function shouldReviewPattern(successRate: number, timesUsed: number): boolean {
  // Not enough data yet
  if (timesUsed < 5) {
    return false;
  }

  // Success rate below 60%
  if (successRate < 60) {
    return true;
  }

  return false;
}

/**
 * Calculate confidence boost to apply based on pattern effectiveness.
 *
 * @param baseBoost Base boost from pattern (e.g., 10.0)
 * @param successRate Pattern success rate (0-100)
 * @param timesUsed How many times pattern has been used
 * @returns Effective boost to apply (0-100)
 */
export function calculateEffectiveBoost(
  baseBoost: number,
  successRate: number,
  timesUsed: number
): number {
  // If pattern is new (< 3 uses), use full boost
  if (timesUsed < 3) {
    return baseBoost;
  }

  // Scale boost by success rate
  const effectiveBoost = (baseBoost * successRate) / 100;

  // Round to 2 decimal places
  return Math.round(effectiveBoost * 100) / 100;
}
