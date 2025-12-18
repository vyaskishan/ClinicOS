/**
 * PATTERN LEARNING AND MANUAL MATCHING DEMONSTRATION
 *
 * This script demonstrates:
 * 1. Pattern extraction from real bank descriptions
 * 2. Manual match creation and pattern learning
 * 3. Pattern application in fuzzy matching
 * 4. Success rate calculation (after multiple uses)
 * 5. Impact comparison: score with vs without patterns
 *
 * Run: npm run test:pattern-demo
 */

import {
  extractPattern,
  matchPattern,
  calculateSuccessRate,
  calculateEffectiveBoost,
} from '../utils/pattern-extraction.utils';

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧠 PATTERN LEARNING & MANUAL MATCHING DEMONSTRATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 1: PATTERN EXTRACTION FROM BANK DESCRIPTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 SECTION 1: PATTERN EXTRACTION EXAMPLES');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const realWorldExamples = [
  {
    description: 'PHAU Payment 123456 - $320',
    payeeName: 'Private Health Australia',
    scenario: 'Private Health Fund Payment',
  },
  {
    description: 'EFT CREDIT MEDICARE AUSTRALIA PATIENT JOHN SMITH REF MCARE2024012001',
    payeeName: 'Medicare Australia',
    scenario: 'Medicare Payment with Transaction ID',
  },
  {
    description: 'BPAY MEDIBANK PRIVATE CLAIM 789012',
    payeeName: 'Medibank Private',
    scenario: 'Medibank Payment',
  },
  {
    description: 'DIRECT DEPOSIT DVA DEPT VETERANS AFFAIRS',
    payeeName: 'Department of Veterans Affairs',
    scenario: 'DVA Payment',
  },
];

realWorldExamples.forEach((example, index) => {
  console.log(`${index + 1}. ${example.scenario}`);
  console.log(`   Bank Description: "${example.description}"`);
  console.log(`   Invoice Payee: "${example.payeeName}"`);
  console.log('');

  const pattern = extractPattern(example.description, example.payeeName);

  console.log(`   🧩 Extracted Pattern: "${pattern.combinedPattern}"`);
  console.log(`   📊 Confidence: ${pattern.confidence}%`);
  console.log('');

  if (pattern.abbreviations.length > 0) {
    console.log(`   🏷️  Abbreviations: ${pattern.abbreviations.join(', ')}`);
  }

  if (pattern.organizationKeywords.length > 0) {
    console.log(
      `   🏢 Organization Keywords: ${pattern.organizationKeywords.slice(0, 3).join(', ')}`
    );
  }

  if (pattern.emailDomains.length > 0) {
    console.log(`   📧 Email Domains: ${pattern.emailDomains.join(', ')}`);
  }

  if (pattern.uniqueIdentifiers.length > 0) {
    console.log(`   🔢 Transaction IDs: ${pattern.uniqueIdentifiers.join(', ')}`);
  }

  console.log('');
  console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 2: PATTERN MATCHING DEMONSTRATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 SECTION 2: PATTERN MATCHING');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

console.log('Scenario: User manually matched "PHAU Payment 123456" to "Private Health Australia"');
console.log('System learned pattern: "PHAU | Private Health Australia"');
console.log('');

const learnedPattern = 'PHAU | Private Health Australia';

const newPayments = [
  'PHAU Transfer $195',
  'EFT PHAU CLAIM 456789',
  'PRIVATE HEALTH AUSTRALIA PAYMENT',
  'PHAU PREMIUM PAYMENT',
  'MEDIBANK PAYMENT 123', // Should NOT match
];

console.log('Testing pattern against new payments:');
console.log('');

newPayments.forEach((payment, index) => {
  const matchScore = matchPattern(payment, learnedPattern);
  const matches = matchScore >= 60;

  console.log(`${index + 1}. "${payment}"`);
  console.log(`   Match Score: ${matchScore}%`);
  console.log(`   Result: ${matches ? '✅ MATCHES' : '❌ NO MATCH'}`);
  console.log('');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 3: SUCCESS RATE CALCULATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 SECTION 3: SUCCESS RATE CALCULATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

console.log('Scenario: Pattern "PHAU | Private Health Australia" used 10 times');
console.log('');

const usageScenarios = [
  {
    description: '8 confirmed, 2 rejected',
    confirmed: 8,
    total: 10,
  },
  {
    description: '10 confirmed, 0 rejected (perfect)',
    confirmed: 10,
    total: 10,
  },
  {
    description: '5 confirmed, 5 rejected (poor)',
    confirmed: 5,
    total: 10,
  },
  {
    description: '3 confirmed, 7 rejected (very poor)',
    confirmed: 3,
    total: 10,
  },
];

usageScenarios.forEach((scenario, index) => {
  const successRate = calculateSuccessRate(scenario.confirmed, scenario.total);
  const baseBoost = 10.0;
  const effectiveBoost = calculateEffectiveBoost(baseBoost, successRate, scenario.total);

  console.log(`${index + 1}. ${scenario.description}`);
  console.log(`   Success Rate: ${successRate}%`);
  console.log(
    `   Effective Boost: ${effectiveBoost.toFixed(2)} points (base: ${baseBoost}, scaled by success rate)`
  );

  if (successRate >= 90) {
    console.log(`   Quality: ⭐⭐⭐ EXCELLENT - High confidence pattern`);
  } else if (successRate >= 75) {
    console.log(`   Quality: ⭐⭐ GOOD - Reliable pattern`);
  } else if (successRate >= 60) {
    console.log(`   Quality: ⭐ FAIR - Acceptable pattern`);
  } else {
    console.log(`   Quality: ⚠️  POOR - Should be reviewed or deleted`);
  }

  console.log('');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 4: IMPACT COMPARISON (WITH VS WITHOUT PATTERNS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚖️  SECTION 4: IMPACT COMPARISON');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const testCases = [
  {
    name: 'Test Case 1: PHAU Payment (Strong Pattern Match)',
    paymentDesc: 'PHAU Transfer $195',
    invoicePayee: 'Private Health Australia',
    patternBoost: 10.0, // Perfect 100% success rate
    baseScores: {
      name: 20.0, // 57% name similarity × 0.35 = 20 points
      amount: 30.0, // Exact amount match
      date: 15.0, // Within 7 days
      alias: 0.0, // No alias match
    },
  },
  {
    name: 'Test Case 2: Medicare Payment (Medium Pattern Match)',
    paymentDesc: 'EFT CREDIT MCARE PAYMENT',
    invoicePayee: 'Medicare Australia',
    patternBoost: 8.5, // 85% success rate
    baseScores: {
      name: 25.0, // 71% name similarity × 0.35 = 25 points
      amount: 30.0, // Exact amount match
      date: 10.0, // Within 14 days
      alias: 5.0, // Alias match
    },
  },
  {
    name: 'Test Case 3: DVA Payment (Low Pattern Match)',
    paymentDesc: 'DEPT VET AFFAIRS PAYMENT',
    invoicePayee: 'Department of Veterans Affairs',
    patternBoost: 6.0, // 60% success rate
    baseScores: {
      name: 28.0, // 80% name similarity × 0.35 = 28 points
      amount: 0.0, // Amount mismatch
      date: 5.0, // Within 30 days
      alias: 0.0, // No alias
    },
  },
];

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. ${testCase.name}`);
  console.log(`   Payment: "${testCase.paymentDesc}"`);
  console.log(`   Invoice Payee: "${testCase.invoicePayee}"`);
  console.log('');

  // Calculate score WITHOUT pattern
  const scoreWithoutPattern =
    testCase.baseScores.name +
    testCase.baseScores.amount +
    testCase.baseScores.date +
    testCase.baseScores.alias;

  // Calculate score WITH pattern
  const scoreWithPattern = scoreWithoutPattern + testCase.patternBoost;

  console.log('   📊 Score Breakdown:');
  console.log(`      Name/Field:  ${testCase.baseScores.name.toFixed(2)} points (35% weight)`);
  console.log(`      Amount:      ${testCase.baseScores.amount.toFixed(2)} points (30% weight)`);
  console.log(`      Date:        ${testCase.baseScores.date.toFixed(2)} points (20% weight)`);
  console.log(`      Alias:       ${testCase.baseScores.alias.toFixed(2)} points (5% weight)`);
  console.log('');

  console.log(`   🧠 WITHOUT Pattern Learning:`);
  console.log(`      Total Score: ${scoreWithoutPattern.toFixed(2)}%`);

  if (scoreWithoutPattern >= 85) {
    console.log(`      Status: ✅ AUTO-CONFIRMED (≥85%)`);
  } else if (scoreWithoutPattern >= 70) {
    console.log(`      Status: ⏳ PENDING REVIEW (70-85%)`);
  } else {
    console.log(`      Status: ❌ NO MATCH (<70%)`);
  }

  console.log('');

  console.log(`   🚀 WITH Pattern Learning:`);
  console.log(`      Pattern Boost: +${testCase.patternBoost.toFixed(2)} points (10% weight)`);
  console.log(`      Total Score: ${scoreWithPattern.toFixed(2)}%`);

  if (scoreWithPattern >= 85) {
    console.log(`      Status: ✅ AUTO-CONFIRMED (≥85%)`);
  } else if (scoreWithPattern >= 70) {
    console.log(`      Status: ⏳ PENDING REVIEW (70-85%)`);
  } else {
    console.log(`      Status: ❌ NO MATCH (<70%)`);
  }

  console.log('');

  // Show impact
  const improvement = scoreWithPattern - scoreWithoutPattern;
  const percentageIncrease = ((improvement / scoreWithoutPattern) * 100).toFixed(1);

  console.log(`   💡 IMPACT:`);
  console.log(
    `      Score Improved: +${improvement.toFixed(2)} points (+${percentageIncrease}%)`
  );

  // Check if pattern changed the outcome
  const wasNoMatch = scoreWithoutPattern < 70;
  const isPendingOrConfirmed = scoreWithPattern >= 70;

  if (wasNoMatch && isPendingOrConfirmed) {
    console.log(`      🎯 CRITICAL: Pattern learning enabled this match!`);
  }

  const wasPending = scoreWithoutPattern >= 70 && scoreWithoutPattern < 85;
  const isAutoConfirmed = scoreWithPattern >= 85;

  if (wasPending && isAutoConfirmed) {
    console.log(`      🎯 Pattern learning upgraded match to AUTO-CONFIRMED!`);
  }

  console.log('');
  console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 5: MACHINE LEARNING WORKFLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔄 SECTION 5: MACHINE LEARNING WORKFLOW');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

console.log('Step-by-Step Workflow:');
console.log('');

console.log('1️⃣  USER MANUALLY MATCHES PAYMENT TO INVOICE');
console.log('   POST /api/matches/manual');
console.log('   {');
console.log('     "payment_id": "uuid",');
console.log('     "invoice_id": "uuid",');
console.log('     "reason": "Recognized payer from description",');
console.log('     "learn_pattern": true');
console.log('   }');
console.log('');

console.log('2️⃣  SYSTEM EXTRACTS PATTERN');
console.log('   Payment: "PHAU Payment 123456"');
console.log('   Invoice Payee: "Private Health Australia"');
console.log('   → Extracted Pattern: "PHAU | Private Health Australia"');
console.log('   → Confidence: 85%');
console.log('');

console.log('3️⃣  PATTERN STORED IN DATABASE');
console.log('   INSERT INTO manual_match_patterns');
console.log('   - pattern: "PHAU | Private Health Australia"');
console.log('   - payee_name: "Private Health Australia"');
console.log('   - confidence_boost: 10.00');
console.log('   - times_used: 0');
console.log('   - success_rate: 100.00%');
console.log('');

console.log('4️⃣  NEW PAYMENT ARRIVES: "PHAU Transfer $195"');
console.log('   POST /api/reconcile/fuzzy');
console.log('');

console.log('5️⃣  FUZZY MATCHING FINDS PATTERN');
console.log('   - Checks payment "PHAU Transfer $195" against patterns');
console.log('   - Finds match: "PHAU | Private Health Australia" (100% match)');
console.log('   - Applies +10 point boost');
console.log('   - Records pattern usage (times_used: 0 → 1)');
console.log('');

console.log('6️⃣  USER CONFIRMS MATCH');
console.log('   PUT /api/matches/:id/confirm');
console.log('   - success_rate remains 100% (1 confirmed / 1 used)');
console.log('');

console.log('7️⃣  PATTERN GETS SMARTER OVER TIME');
console.log('   After 10 uses:');
console.log('   - 8 confirmed, 2 rejected');
console.log('   - success_rate: 80%');
console.log('   - effective_boost: 10.00 × 0.80 = 8.00 points');
console.log('');

console.log('8️⃣  LOW-PERFORMING PATTERNS FLAGGED');
console.log('   If success_rate < 60% after 5+ uses:');
console.log('   → System flags pattern for review/deletion');
console.log('   → Admin can adjust or remove pattern');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

console.log('✅ DEMONSTRATION COMPLETE');
console.log('');
console.log('Key Takeaways:');
console.log('  • Pattern learning automates future matching');
console.log('  • Success rate ensures patterns stay accurate');
console.log('  • Pattern boost can upgrade matches from PENDING to AUTO-CONFIRMED');
console.log('  • System learns from user feedback and improves over time');
console.log('');
console.log('API Endpoints:');
console.log('  • POST /api/matches/manual - Create manual match & learn pattern');
console.log('  • GET /api/patterns - List all learned patterns');
console.log('  • PUT /api/patterns/:id - Update pattern boost');
console.log('  • DELETE /api/patterns/:id - Delete ineffective pattern');
console.log('  • GET /api/patterns/suggestions?payment_id=uuid - Get pattern suggestions');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
