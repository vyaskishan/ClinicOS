/**
 * AUTO-RECONCILIATION CONFIGURATION
 *
 * Purpose: Define keywords and patterns for automatically identifying reconciled transactions.
 *
 * These patterns detect payments that are already reconciled through integrated systems:
 * - TYRO: EFTPOS terminal payments
 * - MEDICARE EASYCLAIM: Medicare bulk billing
 * - DVA: Department of Veterans Affairs
 *
 * When a payment description matches these patterns:
 * 1. auto_reconciled flag is set to TRUE
 * 2. auto_reconciled_source is set to the system name
 * 3. status is set to 'auto_reconciled'
 * 4. Transaction is excluded from manual reconciliation matching
 * 5. Kept in database for audit trail and analytics
 *
 * IMPORTANT: This file can be modified to add/remove auto-reconciliation sources
 * without code changes. Just update the patterns array and restart the application.
 */

export interface AutoReconciliationPattern {
  /** Unique identifier for this auto-reconciliation source */
  source: string;

  /** Display name for reporting */
  displayName: string;

  /** Array of keywords/patterns to match in payment description (case-insensitive) */
  keywords: string[];

  /** Whether this pattern is currently active */
  enabled: boolean;

  /** Optional: Regex pattern for more complex matching */
  regexPattern?: RegExp;
}

/**
 * Auto-reconciliation patterns configuration
 *
 * Add new patterns here to support additional auto-reconciliation sources.
 * Patterns are checked in order, first match wins.
 */
export const AUTO_RECONCILIATION_PATTERNS: AutoReconciliationPattern[] = [
  {
    source: 'TYRO',
    displayName: 'Tyro EFTPOS',
    keywords: ['TYRO', 'TYRO EFTPOS', 'TYRO PAYMENT'],
    enabled: true,
    regexPattern: /TYRO[\s\-]?(EFTPOS|PAYMENT)?/i,
  },
  {
    source: 'MEDICARE_EASYCLAIM',
    displayName: 'Medicare EasyClaim',
    keywords: ['MEDICARE EASYCLAIM', 'EASYCLAIM', 'MEDICARE BULK'],
    enabled: true,
    regexPattern: /MEDICARE[\s\-]?(EASYCLAIM|BULK)/i,
  },
  {
    source: 'DVA',
    displayName: 'Department of Veterans Affairs',
    keywords: ['DVA', 'DEPT VETERANS', 'VETERANS AFFAIRS', 'DVA PAYMENT'],
    enabled: true,
    regexPattern: /(DVA|VETERANS[\s\-]?AFFAIRS|DEPT[\s\-]?VETERANS)/i,
  },
  // Add more patterns here as needed
  // Example:
  // {
  //   source: 'HICAPS',
  //   displayName: 'HICAPS Terminal',
  //   keywords: ['HICAPS', 'HICAPS PAYMENT'],
  //   enabled: true,
  //   regexPattern: /HICAPS/i,
  // },
];

/**
 * Detect if a payment description indicates auto-reconciled transaction
 *
 * @param description Payment description from bank feed
 * @returns Auto-reconciliation info or null if not auto-reconciled
 */
export function detectAutoReconciliation(
  description: string
): { source: string; displayName: string } | null {
  if (!description) {
    return null;
  }

  const descriptionUpper = description.toUpperCase();

  for (const pattern of AUTO_RECONCILIATION_PATTERNS) {
    // Skip disabled patterns
    if (!pattern.enabled) {
      continue;
    }

    // Check regex pattern first (more specific)
    if (pattern.regexPattern && pattern.regexPattern.test(description)) {
      return {
        source: pattern.source,
        displayName: pattern.displayName,
      };
    }

    // Check keywords (case-insensitive)
    for (const keyword of pattern.keywords) {
      if (descriptionUpper.includes(keyword.toUpperCase())) {
        return {
          source: pattern.source,
          displayName: pattern.displayName,
        };
      }
    }
  }

  return null;
}

/**
 * Get list of all enabled auto-reconciliation sources
 *
 * @returns Array of enabled source names
 */
export function getEnabledAutoReconciliationSources(): string[] {
  return AUTO_RECONCILIATION_PATTERNS.filter((p) => p.enabled).map((p) => p.source);
}

/**
 * Get display name for auto-reconciliation source
 *
 * @param source Source identifier (e.g., 'TYRO')
 * @returns Display name or source if not found
 */
export function getAutoReconciliationDisplayName(source: string): string {
  const pattern = AUTO_RECONCILIATION_PATTERNS.find((p) => p.source === source);
  return pattern?.displayName || source;
}

export default {
  AUTO_RECONCILIATION_PATTERNS,
  detectAutoReconciliation,
  getEnabledAutoReconciliationSources,
  getAutoReconciliationDisplayName,
};
