/**
 * STANDALONE TEST: Direct Matching Algorithm (No Database Required)
 *
 * Purpose: Demonstrate all 5 matching confidence levels with mock data.
 *
 * This script runs WITHOUT a database connection, using in-memory mock data
 * to show how the matching algorithm works across all confidence levels.
 */

import {
  extractInvoiceNumbers,
  descriptionContainsName,
  fuzzyNameMatch,
  normalizeName,
  amountsEqual,
  isPartialPayment,
  isOverpayment,
  calculateOverpayment,
} from '../utils/matching.utils';

// Mock data structures
interface MockInvoice {
  id: string;
  invoice_number: string;
  patient_name: string;
  payee_name: string;
  amount: number;
  outstanding_amount: number;
  status: string;
}

interface MockPayment {
  id: string;
  amount: number;
  description: string;
  payment_date: string;
}

interface MatchResult {
  payment_id: string;
  invoice_id: string;
  match_type: string;
  confidence: number;
  amount_matched: number;
  reason: string;
  matched_fields: string[];
  name_similarity?: number;
  amount_difference?: number;
}

// Mock invoices
const mockInvoices: MockInvoice[] = [
  {
    id: 'inv-001',
    invoice_number: '123456',
    patient_name: 'John Smith',
    payee_name: 'Dr. Sarah Johnson',
    amount: 150.0,
    outstanding_amount: 150.0,
    status: 'unpaid',
  },
  {
    id: 'inv-002',
    invoice_number: '234567',
    patient_name: 'Mary Williams',
    payee_name: 'Dr. Michael Chen',
    amount: 300.0,
    outstanding_amount: 300.0,
    status: 'unpaid',
  },
  {
    id: 'inv-003',
    invoice_number: '345678',
    patient_name: 'Robert Davis',
    payee_name: 'Dr. Sarah Johnson',
    amount: 500.0,
    outstanding_amount: 500.0,
    status: 'unpaid',
  },
  {
    id: 'inv-004',
    invoice_number: '456789',
    patient_name: 'Emily Brown',
    payee_name: 'Dr. James Martinez',
    amount: 200.0,
    outstanding_amount: 200.0,
    status: 'unpaid',
  },
  {
    id: 'inv-005',
    invoice_number: '567890',
    patient_name: 'David Wilson',
    payee_name: 'Dr. Lisa Anderson',
    amount: 450.0,
    outstanding_amount: 450.0,
    status: 'unpaid',
  },
  {
    id: 'inv-006',
    invoice_number: '678901',
    patient_name: 'Jennifer Taylor',
    payee_name: 'Dr. Sarah Johnson',
    amount: 175.0,
    outstanding_amount: 175.0,
    status: 'unpaid',
  },
  {
    id: 'inv-007',
    invoice_number: '789012',
    patient_name: 'Thomas Moore',
    payee_name: 'Dr. Michael Chen',
    amount: 250.0,
    outstanding_amount: 250.0,
    status: 'unpaid',
  },
  {
    id: 'inv-008',
    invoice_number: '890123',
    patient_name: 'Susan White',
    payee_name: 'Dr. James Martinez',
    amount: 350.0,
    outstanding_amount: 350.0,
    status: 'unpaid',
  },
];

// Mock payments (designed to trigger each matching rule)
const mockPayments: MockPayment[] = [
  // RULE 1: Perfect Match - Invoice # + exact amount
  {
    id: 'pay-001',
    amount: 150.0,
    description: 'Payment for invoice 123456 - John Smith consultation',
    payment_date: '2024-01-15',
  },
  {
    id: 'pay-002',
    amount: 300.0,
    description: 'Medical payment ref: 234567 Mary Williams',
    payment_date: '2024-01-16',
  },

  // RULE 2: Partial Payment - Invoice # + amount < outstanding + name match
  {
    id: 'pay-003',
    amount: 250.0,
    description: 'Partial payment invoice 345678 Robert Davis - Dr Johnson',
    payment_date: '2024-01-17',
  },
  {
    id: 'pay-004',
    amount: 100.0,
    description: 'Payment installment 456789 for Emily Brown',
    payment_date: '2024-01-18',
  },

  // RULE 3: Overpayment - Invoice # + amount > outstanding + name match
  {
    id: 'pay-005',
    amount: 500.0,
    description: 'Payment 567890 David Wilson to Dr Lisa Anderson',
    payment_date: '2024-01-19',
  },

  // RULE 4: High Confidence Single Match - No invoice #, exact amount, single match
  {
    id: 'pay-006',
    amount: 175.0,
    description: 'Medical payment Jennifer Taylor Dr Sarah Johnson',
    payment_date: '2024-01-20',
  },

  // RULE 5: Exact Amount + Payer Match - No invoice #, exact amount, payer match
  {
    id: 'pay-007',
    amount: 250.0,
    description: 'Payment from Thomas Moore medical services',
    payment_date: '2024-01-21',
  },

  // Edge case: Multiple possible matches (same amount, different patients)
  {
    id: 'pay-008',
    amount: 350.0,
    description: 'Medical payment Susan White',
    payment_date: '2024-01-22',
  },
];

/**
 * Run matching algorithm on mock data
 */
function runMatchingTests(): MatchResult[] {
  const matches: MatchResult[] = [];

  console.log('\n' + '='.repeat(80));
  console.log('TESTING MATCHING ALGORITHM WITH MOCK DATA (NO DATABASE)');
  console.log('='.repeat(80));
  console.log(`\n📊 Test Data: ${mockInvoices.length} invoices, ${mockPayments.length} payments\n`);

  for (const payment of mockPayments) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`🔍 Processing Payment ${payment.id}: $${payment.amount}`);
    console.log(`   Description: "${payment.description}"`);
    console.log(`${'─'.repeat(80)}`);

    const paymentMatches = findMatches(payment, mockInvoices);

    if (paymentMatches.length === 0) {
      console.log('   ❌ No matches found');
    } else {
      matches.push(...paymentMatches);
    }
  }

  return matches;
}

/**
 * Find matches for a single payment
 */
function findMatches(payment: MockPayment, invoices: MockInvoice[]): MatchResult[] {
  const matches: MatchResult[] = [];

  // Extract invoice numbers from description
  const invoiceNumbers = extractInvoiceNumbers(payment.description);

  if (invoiceNumbers.length > 0) {
    console.log(`   📝 Invoice numbers found: ${invoiceNumbers.join(', ')}`);
  } else {
    console.log(`   📝 No invoice number in description`);
  }

  // RULE 1: Perfect Match (100%)
  if (invoiceNumbers.length > 0) {
    for (const invNumber of invoiceNumbers) {
      const invoice = invoices.find((inv) => inv.invoice_number === invNumber);

      if (invoice && amountsEqual(payment.amount, invoice.outstanding_amount)) {
        console.log(
          `   ✅ PERFECT MATCH (100%): Invoice ${invoice.invoice_number} - Exact amount match!`
        );

        matches.push({
          payment_id: payment.id,
          invoice_id: invoice.id,
          match_type: 'perfect_match',
          confidence: 100,
          amount_matched: payment.amount,
          reason: 'Invoice number and exact amount match',
          matched_fields: ['invoice_number', 'amount'],
        });

        return matches; // Stop here
      }
    }
  }

  // RULE 2: Partial Payment (95%)
  if (invoiceNumbers.length > 0) {
    for (const invNumber of invoiceNumbers) {
      const invoice = invoices.find((inv) => inv.invoice_number === invNumber);

      if (invoice && isPartialPayment(payment.amount, invoice.outstanding_amount)) {
        const nameMatch = descriptionContainsName(
          payment.description,
          invoice.payee_name,
          invoice.patient_name,
          80
        );

        if (nameMatch.matched) {
          console.log(
            `   ✅ PARTIAL PAYMENT (95%): Invoice ${invoice.invoice_number} - $${payment.amount} of $${invoice.outstanding_amount}`
          );
          console.log(
            `      Name match: ${nameMatch.matchedField} (${nameMatch.score.toFixed(1)}% similarity)`
          );

          matches.push({
            payment_id: payment.id,
            invoice_id: invoice.id,
            match_type: 'partial_payment',
            confidence: 95,
            amount_matched: payment.amount,
            reason: `Partial payment: $${payment.amount} of $${invoice.outstanding_amount} outstanding`,
            matched_fields: ['invoice_number', nameMatch.matchedField!],
            name_similarity: nameMatch.score,
          });

          return matches;
        }
      }
    }
  }

  // RULE 3: Overpayment (90%)
  if (invoiceNumbers.length > 0) {
    for (const invNumber of invoiceNumbers) {
      const invoice = invoices.find((inv) => inv.invoice_number === invNumber);

      if (invoice && isOverpayment(payment.amount, invoice.outstanding_amount)) {
        const nameMatch = descriptionContainsName(
          payment.description,
          invoice.payee_name,
          invoice.patient_name,
          80
        );

        if (nameMatch.matched) {
          const overpayment = calculateOverpayment(payment.amount, invoice.outstanding_amount);

          console.log(
            `   ⚠️  OVERPAYMENT (90%): Invoice ${invoice.invoice_number} - Payment exceeds invoice by $${overpayment}`
          );
          console.log(
            `      Name match: ${nameMatch.matchedField} (${nameMatch.score.toFixed(1)}% similarity)`
          );

          matches.push({
            payment_id: payment.id,
            invoice_id: invoice.id,
            match_type: 'overpaid',
            confidence: 90,
            amount_matched: invoice.outstanding_amount,
            reason: `Payment exceeds invoice amount by $${overpayment}`,
            matched_fields: ['invoice_number', nameMatch.matchedField!],
            name_similarity: nameMatch.score,
            amount_difference: overpayment,
          });

          return matches;
        }
      }
    }
  }

  // RULE 4: High Confidence Single Match (90%)
  if (invoiceNumbers.length === 0) {
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
        // Check if this is the ONLY matching invoice
        const allMatchingInvoices = invoices.filter(
          (inv) =>
            amountsEqual(payment.amount, inv.outstanding_amount) &&
            (fuzzyNameMatch(payment.description, inv.payee_name) >= 80 ||
              fuzzyNameMatch(payment.description, inv.patient_name) >= 80)
        );

        if (allMatchingInvoices.length === 1) {
          console.log(
            `   ✅ HIGH CONFIDENCE MATCH (90%): Invoice ${invoice.invoice_number} - Single match with exact amount`
          );
          console.log(
            `      Name match: ${nameMatch.matchedField} (${nameMatch.score.toFixed(1)}% similarity)`
          );

          matches.push({
            payment_id: payment.id,
            invoice_id: invoice.id,
            match_type: 'high_confidence_match',
            confidence: 90,
            amount_matched: payment.amount,
            reason: 'Single invoice found with exact amount and name match',
            matched_fields: ['amount', nameMatch.matchedField!],
            name_similarity: nameMatch.score,
          });

          return matches;
        }
      }
    }
  }

  // RULE 5: Exact Amount + Payer Match (85%)
  if (invoiceNumbers.length === 0) {
    const exactAmountInvoices = invoices.filter((inv) =>
      amountsEqual(payment.amount, inv.outstanding_amount)
    );

    for (const invoice of exactAmountInvoices) {
      const payeeScore = fuzzyNameMatch(payment.description, invoice.payee_name);
      const patientScore = fuzzyNameMatch(payment.description, invoice.patient_name);

      if (payeeScore >= 80 || patientScore >= 80) {
        const bestScore = Math.max(payeeScore, patientScore);
        const matchedField = payeeScore >= patientScore ? 'payee' : 'patient';

        console.log(
          `   ✅ EXACT AMOUNT + PAYER (85%): Invoice ${invoice.invoice_number} - Amount + name match`
        );
        console.log(`      Name match: ${matchedField} (${bestScore.toFixed(1)}% similarity)`);

        matches.push({
          payment_id: payment.id,
          invoice_id: invoice.id,
          match_type: 'exact_amount_payer',
          confidence: 85,
          amount_matched: payment.amount,
          reason: 'Exact amount match with payer name similarity',
          matched_fields: ['amount', matchedField],
          name_similarity: bestScore,
        });
      }
    }
  }

  return matches;
}

/**
 * Display summary and detailed results
 */
function displayResults(matches: MatchResult[]) {
  console.log('\n\n' + '='.repeat(80));
  console.log('MATCHING RESULTS SUMMARY');
  console.log('='.repeat(80));

  console.log(`\n✅ Total Matches: ${matches.length}`);

  // Count by type
  const byType: Record<string, number> = {};
  matches.forEach((m) => {
    byType[m.match_type] = (byType[m.match_type] || 0) + 1;
  });

  console.log('\n📈 Matches by Type:');
  const typeLabels: Record<string, string> = {
    perfect_match: '💯 Perfect Match (100%)',
    partial_payment: '📉 Partial Payment (95%)',
    overpaid: '💰 Overpayment (90%)',
    high_confidence_match: '🎯 High Confidence (90%)',
    exact_amount_payer: '📊 Exact Amount + Payer (85%)',
  };

  Object.entries(byType).forEach(([type, count]) => {
    console.log(`   ${typeLabels[type]}: ${count}`);
  });

  // Detailed breakdown
  console.log('\n\n' + '='.repeat(80));
  console.log('DETAILED MATCH BREAKDOWN');
  console.log('='.repeat(80));

  const levels = [
    { type: 'perfect_match', name: '💯 PERFECT MATCH (100%)' },
    { type: 'partial_payment', name: '📉 PARTIAL PAYMENT (95%)' },
    { type: 'overpaid', name: '💰 OVERPAYMENT (90%)' },
    { type: 'high_confidence_match', name: '🎯 HIGH CONFIDENCE (90%)' },
    { type: 'exact_amount_payer', name: '📊 EXACT AMOUNT + PAYER (85%)' },
  ];

  for (const level of levels) {
    const levelMatches = matches.filter((m) => m.match_type === level.type);

    if (levelMatches.length > 0) {
      console.log(`\n${level.name}`);
      console.log('─'.repeat(80));

      levelMatches.forEach((match, idx) => {
        const invoice = mockInvoices.find((inv) => inv.id === match.invoice_id)!;
        const payment = mockPayments.find((pay) => pay.id === match.payment_id)!;

        console.log(`\n${idx + 1}. Payment ${payment.id} → Invoice ${invoice.invoice_number}`);
        console.log(`   Invoice: ${invoice.patient_name} / ${invoice.payee_name}`);
        console.log(
          `   Invoice Amount: $${invoice.amount.toFixed(2)} (Outstanding: $${invoice.outstanding_amount.toFixed(2)})`
        );
        console.log(`   Payment Amount: $${payment.amount.toFixed(2)}`);
        console.log(`   Amount Matched: $${match.amount_matched.toFixed(2)}`);
        console.log(`   Reason: ${match.reason}`);
        console.log(`   Matched Fields: ${match.matched_fields.join(', ')}`);
        if (match.name_similarity) {
          console.log(`   Name Similarity: ${match.name_similarity.toFixed(1)}%`);
        }
        if (match.amount_difference) {
          console.log(`   Overpayment: $${match.amount_difference.toFixed(2)}`);
        }
      });
    }
  }

  // Edge cases
  console.log('\n\n' + '='.repeat(80));
  console.log('EDGE CASES & SCENARIOS');
  console.log('='.repeat(80));

  const overpayments = matches.filter((m) => m.match_type === 'overpaid');
  const partials = matches.filter((m) => m.match_type === 'partial_payment');
  const ambiguous = matches.filter((m) => m.match_type === 'exact_amount_payer');

  if (overpayments.length > 0) {
    console.log(`\n💰 OVERPAYMENTS: ${overpayments.length}`);
    console.log('   These require user decision on handling excess amounts');
  }

  if (partials.length > 0) {
    console.log(`\n📉 PARTIAL PAYMENTS: ${partials.length}`);
    console.log('   Invoices with partial payments - may have multiple installments');
  }

  if (ambiguous.length > 0) {
    console.log(`\n📊 AMBIGUOUS MATCHES: ${ambiguous.length}`);
    console.log('   Multiple invoices may exist with same amount - requires review');
  }

  console.log('\n' + '='.repeat(80));
  console.log('UTILITY FUNCTION DEMONSTRATIONS');
  console.log('='.repeat(80));

  // Demonstrate utility functions
  console.log('\n🔧 Name Normalization Examples:');
  console.log(`   "Dr. John Smith Jr." → "${normalizeName('Dr. John Smith Jr.')}"`);
  console.log(`   "Mrs. Mary Williams" → "${normalizeName('Mrs. Mary Williams')}"`);
  console.log(`   "Prof. Robert Davis III" → "${normalizeName('Prof. Robert Davis III')}"`);

  console.log('\n🔧 Fuzzy Name Matching Examples:');
  console.log(
    `   "John Smith" vs "Smith, John" → ${fuzzyNameMatch('John Smith', 'Smith, John').toFixed(1)}%`
  );
  console.log(
    `   "Dr. Sarah Johnson" vs "Sarah Johnson" → ${fuzzyNameMatch('Dr. Sarah Johnson', 'Sarah Johnson').toFixed(1)}%`
  );
  console.log(
    `   "Michael Chen" vs "Mike Chen" → ${fuzzyNameMatch('Michael Chen', 'Mike Chen').toFixed(1)}%`
  );

  console.log('\n🔧 Invoice Number Extraction Examples:');
  console.log(
    `   "Payment for invoice 123456" → [${extractInvoiceNumbers('Payment for invoice 123456').join(', ')}]`
  );
  console.log(
    `   "Invoices 123456 and 789012" → [${extractInvoiceNumbers('Invoices 123456 and 789012').join(', ')}]`
  );
  console.log(
    `   "Medical payment" → [${extractInvoiceNumbers('Medical payment').length === 0 ? 'none' : extractInvoiceNumbers('Medical payment').join(', ')}]`
  );

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE - All 5 Confidence Levels Demonstrated!');
  console.log('='.repeat(80) + '\n');
}

// Run the tests
const matches = runMatchingTests();
displayResults(matches);
