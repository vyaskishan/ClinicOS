/**
 * TEXT EXTRACTION AND PARSING UTILITIES
 *
 * Purpose: Extract meaningful information from bank feed descriptions and payment text.
 *
 * Extracts:
 * - Email domains (e.g., "medicare.gov.au" from "support@medicare.gov.au")
 * - Person names (e.g., "JOHN SMITH", "Sarah Johnson")
 * - Transaction IDs / Reference codes (e.g., "MCARE2024012001", "REF123")
 * - Organization names (e.g., "MEDICARE AUSTRALIA", "BUPA")
 * - Removes noise words (e.g., "EFT", "PAYMENT", "TRANSFER")
 */

/**
 * Common noise words to filter out from descriptions
 */
const NOISE_WORDS = new Set([
  // Transaction types
  'eft',
  'bpay',
  'payment',
  'transfer',
  'credit',
  'debit',
  'deposit',
  'withdrawal',
  'direct',
  'electronic',
  'funds',
  // Common descriptors
  'ref',
  'reference',
  'transaction',
  'txn',
  'patient',
  'invoice',
  'bill',
  'claim',
  'remittance',
  'advice',
  'statement',
  // Generic words
  'for',
  'from',
  'to',
  'the',
  'and',
  'or',
  'at',
  'in',
  'on',
  'with',
  'of',
  'by',
]);

/**
 * Known organization keywords that indicate a payer name
 */
const ORGANIZATION_KEYWORDS = [
  'medicare',
  'dva',
  'veterans',
  'affairs',
  'medibank',
  'bupa',
  'hcf',
  'health',
  'insurance',
  'fund',
  'private',
  'australia',
  'department',
  'clinic',
  'hospital',
  'medical',
  'centre',
  'center',
];

/**
 * Extract email domain from text
 */
export function extractEmailDomain(text: string): string | null {
  // Match email pattern
  const emailPattern = /\b[\w\.-]+@([\w\.-]+\.[a-z]{2,})\b/gi;
  const match = emailPattern.exec(text);

  if (match && match[1]) {
    return match[1].toLowerCase();
  }

  return null;
}

/**
 * Extract all email domains from text
 */
export function extractEmailDomains(text: string): string[] {
  const emailPattern = /\b[\w\.-]+@([\w\.-]+\.[a-z]{2,})\b/gi;
  const domains: string[] = [];
  let match;

  while ((match = emailPattern.exec(text)) !== null) {
    if (match[1]) {
      domains.push(match[1].toLowerCase());
    }
  }

  return domains;
}

/**
 * Extract transaction IDs / reference codes from text
 */
export function extractTransactionIds(text: string): string[] {
  const ids: string[] = [];

  // Pattern 1: After keywords like "REF", "TXN", "ID", etc.
  const keywordPatterns = [
    /(?:ref|reference|txn|transaction|id|code|number)[\s:#-]*([A-Z0-9]{6,})/gi,
  ];

  keywordPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        ids.push(match[1]);
      }
    }
  });

  // Pattern 2: Standalone alphanumeric codes (must have both letters and numbers)
  const standalonePattern = /\b([A-Z]{2,}\d{6,}|\d{6,}[A-Z]{2,}|[A-Z]\d{8,})\b/g;
  let match;
  while ((match = standalonePattern.exec(text)) !== null) {
    if (match[1] && /[A-Z]/.test(match[1]) && /\d/.test(match[1])) {
      ids.push(match[1]);
    }
  }

  // Remove duplicates and return
  return [...new Set(ids)];
}

/**
 * Extract person names from text
 * Looks for capitalized word sequences that might be names
 */
export function extractPersonNames(text: string): string[] {
  const names: string[] = [];

  // Remove common organization keywords first
  let cleanText = text;
  ORGANIZATION_KEYWORDS.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    cleanText = cleanText.replace(regex, '');
  });

  // Pattern: 2-4 capitalized words in sequence (likely a name)
  // Must start with capital letter, can have lowercase letters
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
  let match;

  while ((match = namePattern.exec(cleanText)) !== null) {
    if (match[1]) {
      const name = match[1].trim();
      // Filter out single words (names should have at least 2 words)
      if (name.split(/\s+/).length >= 2) {
        names.push(name);
      }
    }
  }

  // Also look for ALL CAPS names (common in bank feeds)
  const capsNamePattern = /\b([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?)\b/g;
  while ((match = capsNamePattern.exec(cleanText)) !== null) {
    if (match[1]) {
      const name = match[1].trim();
      // Convert to title case
      const titleCase = name
        .split(/\s+/)
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ');
      names.push(titleCase);
    }
  }

  // Remove duplicates (case-insensitive)
  const uniqueNames = names.filter(
    (name, index, self) =>
      index === self.findIndex((n) => n.toLowerCase() === name.toLowerCase())
  );

  return uniqueNames;
}

/**
 * Extract organization/payer names from text
 */
export function extractOrganizationNames(text: string): string[] {
  const orgs: string[] = [];

  // Look for sequences containing organization keywords
  ORGANIZATION_KEYWORDS.forEach((keyword) => {
    const regex = new RegExp(
      `\\b([A-Z][A-Za-z]*(?:\\s+[A-Z][A-Za-z]*){0,4}\\s+${keyword}(?:\\s+[A-Z][A-Za-z]*){0,2})\\b`,
      'gi'
    );
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        orgs.push(match[1].trim());
      }
    }
  });

  // Also add standalone matches
  ORGANIZATION_KEYWORDS.forEach((keyword) => {
    const regex = new RegExp(`\\b(${keyword}(?:\\s+[A-Z][A-Za-z]*){1,3})\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        orgs.push(match[1].trim());
      }
    }
  });

  // Remove duplicates (case-insensitive)
  const uniqueOrgs = orgs.filter(
    (org, index, self) =>
      index === self.findIndex((o) => o.toLowerCase() === org.toLowerCase())
  );

  return uniqueOrgs;
}

/**
 * Tokenize text and remove noise words
 */
export function tokenizeAndClean(text: string): string[] {
  // Convert to lowercase and split by non-alphanumeric characters
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2); // Remove very short tokens

  // Filter out noise words
  const cleanTokens = tokens.filter((token) => !NOISE_WORDS.has(token));

  return cleanTokens;
}

/**
 * Extract meaningful keywords from description
 * Returns cleaned tokens with noise words removed
 */
export function extractKeywords(text: string): string[] {
  const tokens = tokenizeAndClean(text);

  // Remove duplicates
  return [...new Set(tokens)];
}

/**
 * Extract all structured data from text
 */
export interface ExtractedData {
  email_domains: string[];
  transaction_ids: string[];
  person_names: string[];
  organization_names: string[];
  keywords: string[];
  clean_text: string;
}

export function extractAllData(text: string): ExtractedData {
  return {
    email_domains: extractEmailDomains(text),
    transaction_ids: extractTransactionIds(text),
    person_names: extractPersonNames(text),
    organization_names: extractOrganizationNames(text),
    keywords: extractKeywords(text),
    clean_text: tokenizeAndClean(text).join(' '),
  };
}

/**
 * Calculate similarity between two sets of keywords
 * Returns percentage of matching keywords
 */
export function keywordSimilarity(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) {
    return 0;
  }

  const set1 = new Set(keywords1.map((k) => k.toLowerCase()));
  const set2 = new Set(keywords2.map((k) => k.toLowerCase()));

  let matches = 0;
  set1.forEach((keyword) => {
    if (set2.has(keyword)) {
      matches++;
    }
  });

  // Calculate Jaccard similarity
  const union = new Set([...set1, ...set2]);
  return (matches / union.size) * 100;
}

/**
 * Check if any transaction IDs match
 */
export function hasTransactionIdMatch(ids1: string[], ids2: string[]): boolean {
  if (ids1.length === 0 || ids2.length === 0) {
    return false;
  }

  const set1 = new Set(ids1.map((id) => id.toUpperCase()));
  const set2 = new Set(ids2.map((id) => id.toUpperCase()));

  for (const id of set1) {
    if (set2.has(id)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if any email domains match
 */
export function hasEmailDomainMatch(domains1: string[], domains2: string[]): boolean {
  if (domains1.length === 0 || domains2.length === 0) {
    return false;
  }

  const set1 = new Set(domains1.map((d) => d.toLowerCase()));
  const set2 = new Set(domains2.map((d) => d.toLowerCase()));

  for (const domain of set1) {
    if (set2.has(domain)) {
      return true;
    }
  }

  return false;
}
