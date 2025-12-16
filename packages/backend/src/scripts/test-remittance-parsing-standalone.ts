/**
 * STANDALONE TEST: Remittance Parsing and Matching (No Database/PDFs Required)
 *
 * Purpose: Demonstrate remittance parsing with payment code extraction
 * and 3-priority matching algorithm using mock text data.
 *
 * This script works WITHOUT:
 * - Database connection
 * - Actual PDF files
 * - File system operations
 */

import {
  parseRemittanceText,
  validateParsedRemittance,
} from '../utils/remittance-parser';
import { fuzzyNameMatch } from '../utils/matching.utils';

// Mock remittance PDF text (as would be extracted from actual PDFs)
const MOCK_REMITTANCES = [
  {
    name: 'Medicare EasyClaim Remittance',
    text: `
Medicare Australia
Remittance Advice

Date: 20/01/2024
Payment Reference: MCARE2024012001
Total Payment: $1,350.00

Invoice Details:
Invoice 123456 - $450.00 - John Smith
Invoice 123457 - $450.00 - Jane Doe
Invoice 123458 - $450.00 - Bob Johnson

Payment will be deposited to your nominated account.
    `.trim(),
  },
  {
    name: 'DVA Payment Advice',
    text: `
Department of Veterans' Affairs
Payment Notification

Processed on: 22-01-2024
Reference: DVA20240122
Amount Paid: $875.50

Line Items:
234567 | $325.00 | Alice Brown
234568 | $275.50 | Charlie Davis
234569 | $275.00 | Diana Evans

Thank you for your service.
    `.trim(),
  },
  {
    name: 'Private Health (No Payment Code)',
    text: `
BUPA Health Insurance
Provider Payment Summary

Date: 25/01/2024
Total: $620.00

Claim Details:
345678 - $310.00 - Emma Wilson
345679 - $310.00 - Frank Miller

Processed via EFT transfer.
    `.trim(),
  },
];

// Mock bank payments (for matching)
const MOCK_BANK_PAYMENTS = [
  {
    id: 'pay-001',
    date: '2024-01-20',
    amount: 1350.0,
    description: 'Medicare Payment MCARE2024012001 EasyClaim',
  },
  {
    id: 'pay-002',
    date: '2024-01-22',
    amount: 875.5,
    description: 'DVA Payment Reference DVA20240122 Veterans Affairs',
  },
  {
    id: 'pay-003',
    date: '2024-01-26',
    amount: 620.0,
    description: 'BUPA Health Insurance Payment',
  },
  {
    id: 'pay-004',
    date: '2024-01-28',
    amount: 450.0,
    description: 'Unrelated payment from another source',
  },
];

console.log('\n' + '='.repeat(80));
console.log('REMITTANCE PARSING & MATCHING DEMO (NO DATABASE REQUIRED)');
console.log('='.repeat(80));

console.log('\n📄 Mock Data:');
console.log(`   ${MOCK_REMITTANCES.length} remittance documents`);
console.log(`   ${MOCK_BANK_PAYMENTS.length} bank payments`);

// Parse each remittance
console.log('\n\n' + '='.repeat(80));
console.log('STEP 1: PARSE REMITTANCE TEXT');
console.log('='.repeat(80));

const parsedRemittances = MOCK_REMITTANCES.map((remittance, index) => {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`📄 Remittance ${index + 1}: ${remittance.name}`);
  console.log(`${'─'.repeat(80)}`);

  // Parse
  const parsed = parseRemittanceText(remittance.text);

  // Validate
  const validation = validateParsedRemittance(parsed);

  // Display results
  console.log(`\n✅ Parsing Results:`);
  console.log(`   Payer Name: ${parsed.payer_name || '(not found)'}`);
  console.log(`   Payment Code: ${parsed.payment_code || '(not found)'} ${parsed.payment_code ? '← CRITICAL for matching' : ''}`);
  console.log(`   Remittance Date: ${parsed.remittance_date ? parsed.remittance_date.toISOString().split('T')[0] : '(not found)'}`);
  console.log(`   Total Amount: $${parsed.total_amount?.toFixed(2) || '0.00'}`);
  console.log(`   Line Items: ${parsed.line_items.length}`);
  console.log(`   Parsing Confidence: ${parsed.parsing_confidence}%`);

  if (parsed.line_items.length > 0) {
    console.log(`\n   Line Items Details:`);
    parsed.line_items.forEach((item, idx) => {
      console.log(`     ${idx + 1}. Invoice ${item.invoice_number}: $${item.amount.toFixed(2)}${item.patient_name ? ` - ${item.patient_name}` : ''}`);
    });
  }

  if (!validation.valid) {
    console.log(`\n   ⚠️  Validation Warnings:`);
    validation.errors.forEach((err) => console.log(`     - ${err}`));
  }

  return {
    name: remittance.name,
    parsed,
    validation,
  };
});

// Match remittances to payments
console.log('\n\n' + '='.repeat(80));
console.log('STEP 2: MATCH REMITTANCES TO BANK PAYMENTS');
console.log('='.repeat(80));
console.log('\nPriority Matching Algorithm:');
console.log('  1. Payment Code Match (95%) - Match by reference code');
console.log('  2. Date + Amount + Payer (85%) - Date ±3 days, exact amount, payer fuzzy >80%');
console.log('  3. Amount + Payer Only (75%) - Exact amount, payer fuzzy >80%\n');

interface Match {
  remittance_name: string;
  payment_id: string;
  match_type: string;
  confidence: number;
  matched_by: string[];
  details: any;
}

const matches: Match[] = [];

parsedRemittances.forEach((remittance) => {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`🔍 Matching: ${remittance.name}`);
  console.log(`${'─'.repeat(80)}`);

  const parsed = remittance.parsed;
  let matched = false;

  // PRIORITY 1: Payment Code Match (95%)
  if (parsed.payment_code && !matched) {
    console.log(`\n   🔑 PRIORITY 1: Payment Code Match`);
    console.log(`      Looking for: "${parsed.payment_code}"`);

    for (const payment of MOCK_BANK_PAYMENTS) {
      if (payment.description.includes(parsed.payment_code)) {
        // Validate amount
        if (parsed.total_amount && Math.abs(payment.amount - parsed.total_amount) <= 1.0) {
          console.log(`      ✅ MATCHED to ${payment.id}`);
          console.log(`         Payment Description: "${payment.description}"`);
          console.log(`         Amount Match: $${payment.amount} ≈ $${parsed.total_amount}`);

          matches.push({
            remittance_name: remittance.name,
            payment_id: payment.id,
            match_type: 'payment_code_match',
            confidence: 95,
            matched_by: ['payment_code', 'amount'],
            details: {
              payment_code: parsed.payment_code,
              amount_difference: Math.abs(payment.amount - parsed.total_amount),
            },
          });

          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      console.log(`      ✗ No payment found with code "${parsed.payment_code}"`);
    }
  }

  // PRIORITY 2: Date + Amount + Payer (85%)
  if (!matched && parsed.remittance_date && parsed.total_amount && parsed.payer_name) {
    console.log(`\n   📅 PRIORITY 2: Date + Amount + Payer Match`);

    for (const payment of MOCK_BANK_PAYMENTS) {
      const paymentDate = new Date(payment.date);
      const remittanceDate = new Date(parsed.remittance_date);
      const daysDiff = Math.abs(
        (paymentDate.getTime() - remittanceDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check date within ±3 days
      if (daysDiff <= 3) {
        // Check amount
        if (Math.abs(payment.amount - parsed.total_amount) <= 1.0) {
          // Check payer name
          const payerSimilarity = fuzzyNameMatch(payment.description, parsed.payer_name);

          if (payerSimilarity >= 80) {
            console.log(`      ✅ MATCHED to ${payment.id}`);
            console.log(`         Date Difference: ${Math.round(daysDiff)} day(s)`);
            console.log(`         Amount Match: $${payment.amount} ≈ $${parsed.total_amount}`);
            console.log(`         Payer Similarity: ${payerSimilarity.toFixed(1)}%`);

            matches.push({
              remittance_name: remittance.name,
              payment_id: payment.id,
              match_type: 'date_amount_payer',
              confidence: 85,
              matched_by: ['date', 'amount', 'payer'],
              details: {
                date_difference_days: Math.round(daysDiff),
                amount_difference: Math.abs(payment.amount - parsed.total_amount),
                payer_similarity: payerSimilarity,
              },
            });

            matched = true;
            break;
          }
        }
      }
    }

    if (!matched) {
      console.log(`      ✗ No payment found matching date/amount/payer criteria`);
    }
  }

  // PRIORITY 3: Amount + Payer Only (75%)
  if (!matched && parsed.total_amount && parsed.payer_name) {
    console.log(`\n   💰 PRIORITY 3: Amount + Payer Match (No Date)` );

    for (const payment of MOCK_BANK_PAYMENTS) {
      // Check amount
      if (Math.abs(payment.amount - parsed.total_amount) <= 1.0) {
        // Check payer name
        const payerSimilarity = fuzzyNameMatch(payment.description, parsed.payer_name);

        if (payerSimilarity >= 80) {
          console.log(`      ✅ MATCHED to ${payment.id}`);
          console.log(`         Amount Match: $${payment.amount} ≈ $${parsed.total_amount}`);
          console.log(`         Payer Similarity: ${payerSimilarity.toFixed(1)}%`);
          console.log(`         ⚠️  No date validation (requires review)`);

          matches.push({
            remittance_name: remittance.name,
            payment_id: payment.id,
            match_type: 'amount_payer',
            confidence: 75,
            matched_by: ['amount', 'payer'],
            details: {
              amount_difference: Math.abs(payment.amount - parsed.total_amount),
              payer_similarity: payerSimilarity,
            },
          });

          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      console.log(`      ✗ No payment found matching amount/payer criteria`);
    }
  }

  if (!matched) {
    console.log(`\n   ❌ NO MATCH FOUND`);
  }
});

// Summary
console.log('\n\n' + '='.repeat(80));
console.log('MATCHING RESULTS SUMMARY');
console.log('='.repeat(80));

console.log(`\n✅ Total Matches: ${matches.length} of ${parsedRemittances.length} remittances`);

// By match type
const byType: Record<string, number> = {};
matches.forEach((m) => {
  byType[m.match_type] = (byType[m.match_type] || 0) + 1;
});

console.log('\n📊 Matches by Type:');
const typeLabels: Record<string, string> = {
  payment_code_match: '🔑 Payment Code Match (95%)',
  date_amount_payer: '📅 Date + Amount + Payer (85%)',
  amount_payer: '💰 Amount + Payer Only (75%)',
};

Object.entries(byType).forEach(([type, count]) => {
  console.log(`   ${typeLabels[type]}: ${count}`);
});

// Detailed matches
console.log('\n\n' + '='.repeat(80));
console.log('DETAILED MATCH BREAKDOWN');
console.log('='.repeat(80));

matches.forEach((match, idx) => {
  console.log(`\n${idx + 1}. ${match.remittance_name}`);
  console.log(`   → Payment: ${match.payment_id}`);
  console.log(`   Match Type: ${match.match_type}`);
  console.log(`   Confidence: ${match.confidence}%`);
  console.log(`   Matched By: ${match.matched_by.join(', ')}`);
  console.log(`   Details:`, JSON.stringify(match.details, null, 2).split('\n').map(line => `     ${line}`).join('\n').trim());
});

// Key insights
console.log('\n\n' + '='.repeat(80));
console.log('KEY INSIGHTS');
console.log('='.repeat(80));

console.log(`
💡 Payment Code Importance:
   Remittances WITH payment codes: ${parsedRemittances.filter(r => r.parsed.payment_code).length}
   Remittances WITHOUT payment codes: ${parsedRemittances.filter(r => !r.parsed.payment_code).length}

   Payment codes provide the HIGHEST confidence (95%) matching because they
   are unique identifiers that appear in both the remittance and bank feed.

💡 Remittance-Assisted Matching:
   After matching a remittance to a payment, all ${parsedRemittances.reduce((sum, r) => sum + r.parsed.line_items.length, 0)} invoice line items
   can be automatically matched to that payment with 90% confidence.

   This eliminates manual matching for bulk payments!

💡 Parsing Confidence:
   ${parsedRemittances.filter(r => r.parsed.parsing_confidence === 100).length} remittances with 100% parsing confidence
   ${parsedRemittances.filter(r => r.parsed.parsing_confidence >= 75 && r.parsed.parsing_confidence < 100).length} remittances with 75-99% parsing confidence

   Higher parsing confidence = more reliable automated matching.
`);

console.log('='.repeat(80));
console.log('DEMO COMPLETE');
console.log('='.repeat(80) + '\n');
