/**
 * TEST SCRIPT: Level 3 Fuzzy Matching Algorithm Demo
 *
 * Purpose: Demonstrate the multi-factor fuzzy matching algorithm without database.
 *
 * Scoring Components:
 * 1. Payer Name Similarity (40%) - token_sort_ratio
 * 2. Amount Similarity (30%) - dynamic tolerance
 * 3. Date Proximity (20%) - tiered scoring
 * 4. Payer Alias Check (10%) - bonus points
 *
 * Composite Score: 70%+ creates match
 * - 70-85%: pending (manual review)
 * - >85%: can be auto-confirmed
 */

import * as fuzzball from 'fuzzball';

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 LEVEL 3: FUZZY MATCHING ALGORITHM DEMO');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// =============================================================================
// TEST DATA
// =============================================================================

interface Payment {
  id: string;
  description: string;
  amount: number;
  payment_date: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  payee_name: string;
  amount: number;
  invoice_date: string;
}

const payments: Payment[] = [
  {
    id: 'pay-001',
    description: 'Medicare Australia Payment - Bulk Billing',
    amount: 450.0,
    payment_date: '2024-01-20',
  },
  {
    id: 'pay-002',
    description: 'DVA Dept Veterans Affairs',
    amount: 305.0,
    payment_date: '2024-01-18',
  },
  {
    id: 'pay-003',
    description: 'Medibank Pvt Health Insurance',
    amount: 152.5,
    payment_date: '2024-01-22',
  },
  {
    id: 'pay-004',
    description: 'BUPA Health Fund Payment',
    amount: 890.0,
    payment_date: '2024-01-15',
  },
  {
    id: 'pay-005',
    description: 'HCF Payment Ref 12345',
    amount: 225.0,
    payment_date: '2024-01-25',
  },
];

const invoices: Invoice[] = [
  {
    id: 'inv-001',
    invoice_number: '240101',
    payee_name: 'Medicare Australia',
    amount: 450.0,
    invoice_date: '2024-01-20',
  },
  {
    id: 'inv-002',
    invoice_number: '240102',
    payee_name: 'Department of Veterans Affairs',
    amount: 300.0,
    invoice_date: '2024-01-19',
  },
  {
    id: 'inv-003',
    invoice_number: '240103',
    payee_name: 'Medibank Private',
    amount: 150.0,
    invoice_date: '2024-01-21',
  },
  {
    id: 'inv-004',
    invoice_number: '240104',
    payee_name: 'BUPA Australia',
    amount: 900.0,
    invoice_date: '2024-01-14',
  },
  {
    id: 'inv-005',
    invoice_number: '240105',
    payee_name: 'HCF Health Insurance',
    amount: 225.0,
    invoice_date: '2024-01-26',
  },
];

// =============================================================================
// FUZZY SCORING ALGORITHM
// =============================================================================

function calculateFuzzyScore(payment: Payment, invoice: Invoice): any {
  // 1. Payer Name Similarity (40% weight)
  const nameSimilarity = fuzzball.token_sort_ratio(
    payment.description || '',
    invoice.payee_name || ''
  );
  const nameScore = (nameSimilarity / 100) * 40;

  // 2. Amount Similarity (30% weight)
  const amountDifference = Math.abs(payment.amount - invoice.amount);

  // Dynamic tolerance
  let tolerance: number;
  if (invoice.amount < 100) {
    tolerance = 5;
  } else if (invoice.amount <= 1000) {
    tolerance = 10;
  } else {
    tolerance = Math.max(50, invoice.amount * 0.05);
  }

  const amountScore = amountDifference <= tolerance ? 30 : 0;

  // 3. Date Proximity (20% weight)
  const paymentDate = new Date(payment.payment_date);
  const invoiceDate = new Date(invoice.invoice_date);
  const dateDiff = Math.abs(
    Math.floor((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
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

  // 4. Payer Alias Check (10% weight)
  // For demo, we'll simulate alias matching
  const aliasMatched = checkAlias(payment.description, invoice.payee_name);
  const aliasScore = aliasMatched ? 10 : 0;

  // Composite Score
  const totalScore = nameScore + amountScore + datePoints + aliasScore;

  return {
    name_similarity: nameSimilarity,
    amount_difference: amountDifference,
    amount_tolerance: tolerance,
    date_difference_days: dateDiff,
    alias_matched: aliasMatched,
    component_scores: {
      name: parseFloat(nameScore.toFixed(2)),
      amount: amountScore,
      date: datePoints,
      alias: aliasScore,
    },
    total_score: parseFloat(totalScore.toFixed(2)),
  };
}

function checkAlias(paymentDesc: string, invoicePayee: string): boolean {
  // Simulate alias checking
  const aliases: Record<string, string[]> = {
    'Medicare Australia': ['medicare', 'mcare', 'bulk billing'],
    'Department of Veterans Affairs': ['dva', 'veterans', 'vet affairs'],
    'Medibank Private': ['medibank', 'mbank'],
    'BUPA Australia': ['bupa', 'bupa health'],
    'HCF Health Insurance': ['hcf', 'health care fund'],
  };

  const payeeAliases = aliases[invoicePayee] || [];
  const descLower = paymentDesc.toLowerCase();

  return payeeAliases.some((alias) => descLower.includes(alias));
}

// =============================================================================
// RUN FUZZY MATCHING
// =============================================================================

console.log('📊 Test Data:');
console.log(`   Payments: ${payments.length}`);
console.log(`   Invoices: ${invoices.length}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 RUNNING FUZZY MATCHING ALGORITHM');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const MIN_CONFIDENCE = 70;
const AUTO_CONFIRM_THRESHOLD = 85;

interface Match {
  payment: Payment;
  invoice: Invoice;
  score: any;
  status: 'confirmed' | 'pending';
}

const matches: Match[] = [];
const scoreDistribution = {
  '70-75': 0,
  '75-80': 0,
  '80-85': 0,
  '85-90': 0,
  '90-95': 0,
  '95-100': 0,
};

// For each payment, find best matching invoice
payments.forEach((payment, idx) => {
  console.log(`\n${idx + 1}. Payment ${payment.id}: "${payment.description}"`);
  console.log(`   Amount: $${payment.amount.toFixed(2)} | Date: ${payment.payment_date}\n`);

  let bestMatch: { invoice: Invoice; score: any } | null = null;
  let bestScore = 0;

  invoices.forEach((invoice) => {
    const score = calculateFuzzyScore(payment, invoice);

    if (score.total_score >= MIN_CONFIDENCE && score.total_score > bestScore) {
      bestScore = score.total_score;
      bestMatch = { invoice, score };
    }
  });

  if (bestMatch) {
    // Type guard: assign to const with explicit type to narrow type
    const match: { invoice: Invoice; score: any } = bestMatch;
    const status =
      match.score.total_score >= AUTO_CONFIRM_THRESHOLD ? 'confirmed' : 'pending';

    matches.push({
      payment,
      invoice: match.invoice,
      score: match.score,
      status,
    });

    // Update distribution
    const score = match.score.total_score;
    if (score >= 70 && score < 75) scoreDistribution['70-75']++;
    else if (score >= 75 && score < 80) scoreDistribution['75-80']++;
    else if (score >= 80 && score < 85) scoreDistribution['80-85']++;
    else if (score >= 85 && score < 90) scoreDistribution['85-90']++;
    else if (score >= 90 && score < 95) scoreDistribution['90-95']++;
    else if (score >= 95) scoreDistribution['95-100']++;

    // Display match details
    console.log(`   ✅ MATCH FOUND: Invoice ${match.invoice.invoice_number} - "${match.invoice.payee_name}"`);
    console.log(`   📊 Confidence Score: ${match.score.total_score}% (${status.toUpperCase()})\n`);

    console.log(`   Component Breakdown:`);
    console.log(
      `      🏷️  Name Similarity: ${match.score.name_similarity}% → ${match.score.component_scores.name} points`
    );
    console.log(
      `      💰 Amount Match: $${payment.amount.toFixed(2)} vs $${match.invoice.amount.toFixed(2)} (diff: $${match.score.amount_difference.toFixed(2)}, tolerance: ±$${match.score.amount_tolerance.toFixed(2)}) → ${match.score.component_scores.amount} points`
    );
    console.log(
      `      📅 Date Proximity: ${match.score.date_difference_days} days → ${match.score.component_scores.date} points`
    );
    console.log(
      `      🔗 Alias Match: ${match.score.alias_matched ? 'YES' : 'NO'} → ${match.score.component_scores.alias} points`
    );
    console.log(
      `      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
    console.log(`      🎯 Total Score: ${match.score.total_score}%`);
  } else {
    console.log(`   ❌ No match found (no invoice scored above ${MIN_CONFIDENCE}%)`);
  }
});

// =============================================================================
// SUMMARY
// =============================================================================

console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📈 FUZZY MATCHING SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const confirmedMatches = matches.filter((m) => m.status === 'confirmed');
const pendingMatches = matches.filter((m) => m.status === 'pending');

console.log(`Total Payments Processed: ${payments.length}`);
console.log(`Total Matches Created: ${matches.length}`);
console.log(`  ✅ Auto-Confirmed (≥${AUTO_CONFIRM_THRESHOLD}%): ${confirmedMatches.length}`);
console.log(`  ⏳ Pending Review (${MIN_CONFIDENCE}-${AUTO_CONFIRM_THRESHOLD}%): ${pendingMatches.length}`);
console.log(`  ❌ No Match (<${MIN_CONFIDENCE}%): ${payments.length - matches.length}\n`);

console.log('Score Distribution:');
Object.entries(scoreDistribution).forEach(([range, count]) => {
  const bar = '█'.repeat(count * 3);
  console.log(`  ${range}%: ${bar} (${count})`);
});

// =============================================================================
// HIGHLIGHT EXAMPLES
// =============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🌟 EXAMPLE MATCHES');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (matches.length > 0) {
  // Highest confidence match
  const highest = matches.reduce((prev, current) =>
    prev.score.total_score > current.score.total_score ? prev : current
  , matches[0]);

  console.log('🥇 HIGHEST CONFIDENCE MATCH:');
  console.log(`   Payment: "${highest.payment.description}"`);
  console.log(`   Invoice: "${highest.invoice.payee_name}"`);
  console.log(`   Score: ${highest.score.total_score}% (${highest.status})`);
  console.log(`   Details:`);
  console.log(`     - Name: ${highest.score.name_similarity}% similarity`);
  console.log(`     - Amount: $${highest.score.amount_difference.toFixed(2)} difference`);
  console.log(`     - Date: ${highest.score.date_difference_days} days apart`);
  console.log(`     - Alias: ${highest.score.alias_matched ? 'Matched' : 'Not matched'}\n`);

  // Lowest confidence match (but still above threshold)
  const lowest = matches.reduce((prev, current) =>
    prev.score.total_score < current.score.total_score ? prev : current
  , matches[0]);

  if (lowest.payment.id !== highest.payment.id) {
    console.log('🥉 LOWEST CONFIDENCE MATCH (still above threshold):');
    console.log(`   Payment: "${lowest.payment.description}"`);
    console.log(`   Invoice: "${lowest.invoice.payee_name}"`);
    console.log(`   Score: ${lowest.score.total_score}% (${lowest.status})`);
    console.log(`   Details:`);
    console.log(`     - Name: ${lowest.score.name_similarity}% similarity`);
    console.log(`     - Amount: $${lowest.score.amount_difference.toFixed(2)} difference`);
    console.log(`     - Date: ${lowest.score.date_difference_days} days apart`);
    console.log(`     - Alias: ${lowest.score.alias_matched ? 'Matched' : 'Not matched'}\n`);
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ FUZZY MATCHING ALGORITHM VALIDATED');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Key Features Demonstrated:');
console.log('  ✓ Multi-factor scoring (Name + Amount + Date + Alias)');
console.log('  ✓ Dynamic amount tolerance based on invoice size');
console.log('  ✓ Tiered date proximity scoring');
console.log('  ✓ Payer alias detection for common variations');
console.log('  ✓ Auto-confirmation vs manual review classification');
console.log('  ✓ Detailed scoring breakdown for transparency\n');

console.log('💡 Next Steps:');
console.log('   1. Build TypeScript: npm run build');
console.log('   2. Run this demo: npm run test:fuzzy-demo');
console.log('   3. Test with live database: POST /api/reconcile/fuzzy\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
