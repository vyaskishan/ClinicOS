/**
 * TEST SCRIPT: Direct Matching Algorithm
 *
 * Purpose: Test Level 1 matching with seed data to demonstrate all 5 confidence levels.
 *
 * This script:
 * 1. Runs the direct matching algorithm
 * 2. Shows matches found for each confidence level
 * 3. Displays edge cases and interesting scenarios
 */

import { runDirectMatching } from '../services/direct-matching.service';
import { query } from '../config/database';

async function testDirectMatching() {
  console.log('\n='.repeat(80));
  console.log('TESTING LEVEL 1: DIRECT/EXACT MATCHING ALGORITHM');
  console.log('='.repeat(80));

  try {
    // First, show current state
    console.log('\n📊 CURRENT STATE:');
    await showCurrentState();

    // Run direct matching
    console.log('\n\n🔍 RUNNING DIRECT MATCHING ALGORITHM...\n');
    const result = await runDirectMatching({
      exclude_auto_reconciled: true,
      auto_confirm_perfect_matches: false,
    });

    // Display results summary
    console.log('\n' + '='.repeat(80));
    console.log('MATCHING RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Total Matches Found: ${result.total_matches}`);
    console.log(`   - Auto-confirmed: ${result.auto_confirmed}`);
    console.log(`   - Requires review: ${result.requires_review}`);

    console.log('\n📈 Matches by Type:');
    Object.entries(result.by_type).forEach(([type, count]) => {
      const emoji =
        type === 'perfect_match'
          ? '💯'
          : type === 'partial_payment'
            ? '📉'
            : type === 'overpaid'
              ? '💰'
              : type === 'high_confidence_match'
                ? '🎯'
                : '📊';
      console.log(`   ${emoji} ${type}: ${count}`);
    });

    // Display detailed matches by confidence level
    console.log('\n\n' + '='.repeat(80));
    console.log('DETAILED MATCHES BY CONFIDENCE LEVEL');
    console.log('='.repeat(80));

    const levels = [
      { type: 'perfect_match', confidence: 100, name: 'Perfect Match' },
      { type: 'partial_payment', confidence: 95, name: 'Partial Payment' },
      { type: 'overpaid', confidence: 90, name: 'Overpayment Detected' },
      { type: 'high_confidence_match', confidence: 90, name: 'High Confidence Single Match' },
      { type: 'exact_amount_payer', confidence: 85, name: 'Exact Amount + Payer Match' },
    ];

    for (const level of levels) {
      const matches = result.matches.filter((m) => m.match_type === level.type);

      if (matches.length > 0) {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`${level.confidence}% - ${level.name.toUpperCase()}`);
        console.log(`${'─'.repeat(80)}`);

        for (const match of matches) {
          await displayMatchDetails(match);
        }
      }
    }

    // Show edge cases
    console.log('\n\n' + '='.repeat(80));
    console.log('EDGE CASES & INTERESTING SCENARIOS');
    console.log('='.repeat(80));
    await showEdgeCases(result.matches);

    // Show final state
    console.log('\n\n📊 FINAL STATE:');
    await showCurrentState();

    console.log('\n' + '='.repeat(80));
    console.log('TEST COMPLETE');
    console.log('='.repeat(80) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    process.exit(1);
  }
}

async function showCurrentState() {
  const invoiceStats = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'unpaid') as unpaid,
      COUNT(*) FILTER (WHERE status = 'partially_paid') as partially_paid,
      COUNT(*) FILTER (WHERE status = 'fully_paid') as fully_paid,
      SUM(outstanding_amount) as total_outstanding
    FROM invoices
  `);

  const paymentStats = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'unmatched') as unmatched,
      COUNT(*) FILTER (WHERE status = 'matched') as matched,
      COUNT(*) FILTER (WHERE auto_reconciled = TRUE) as auto_reconciled,
      SUM(amount) as total_amount
    FROM payments
  `);

  const matchStats = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected
    FROM matches
  `);

  console.log(`
   Invoices:
     - Total: ${invoiceStats.rows[0].total}
     - Unpaid: ${invoiceStats.rows[0].unpaid}
     - Partially Paid: ${invoiceStats.rows[0].partially_paid}
     - Fully Paid: ${invoiceStats.rows[0].fully_paid}
     - Total Outstanding: $${parseFloat(invoiceStats.rows[0].total_outstanding || 0).toFixed(2)}

   Payments:
     - Total: ${paymentStats.rows[0].total}
     - Unmatched: ${paymentStats.rows[0].unmatched}
     - Matched: ${paymentStats.rows[0].matched}
     - Auto-reconciled: ${paymentStats.rows[0].auto_reconciled}
     - Total Amount: $${parseFloat(paymentStats.rows[0].total_amount || 0).toFixed(2)}

   Matches:
     - Total: ${matchStats.rows[0].total}
     - Pending: ${matchStats.rows[0].pending}
     - Confirmed: ${matchStats.rows[0].confirmed}
     - Rejected: ${matchStats.rows[0].rejected}
  `);
}

async function displayMatchDetails(match: any) {
  // Fetch invoice and payment details
  const invoice = await query(
    `SELECT invoice_number, patient_name, payee_name, amount, outstanding_amount
     FROM invoices WHERE id = $1`,
    [match.invoice_id]
  );

  const payment = await query(
    `SELECT payment_date, amount, description
     FROM payments WHERE id = $1`,
    [match.payment_id]
  );

  const inv = invoice.rows[0];
  const pay = payment.rows[0];

  console.log(`
   Match ID: ${match.match_id.substring(0, 8)}...
   Invoice: ${inv.invoice_number} - ${inv.patient_name} / ${inv.payee_name}
   Invoice Amount: $${inv.amount} (Outstanding: $${inv.outstanding_amount})
   Payment: $${pay.amount} on ${new Date(pay.payment_date).toLocaleDateString()}
   Description: "${pay.description.substring(0, 60)}..."
   Amount Matched: $${match.amount_matched}
   Requires Review: ${match.requires_review ? 'YES' : 'NO'}
   Reason: ${match.details.reason}
   Matched Fields: ${match.details.matched_fields.join(', ')}${
     match.details.name_similarity
       ? `\n   Name Similarity: ${match.details.name_similarity.toFixed(1)}%`
       : ''
   }${
     match.details.amount_difference
       ? `\n   Amount Difference: $${match.details.amount_difference}`
       : ''
   }
  `);
}

async function showEdgeCases(matches: any[]) {
  const edgeCases = [];

  // Find overpayments
  const overpayments = matches.filter((m) => m.match_type === 'overpaid');
  if (overpayments.length > 0) {
    edgeCases.push({
      title: '💰 OVERPAYMENTS DETECTED',
      description:
        'Payments exceed invoice amounts - requires user decision on handling excess',
      count: overpayments.length,
    });
  }

  // Find partial payments
  const partialPayments = matches.filter((m) => m.match_type === 'partial_payment');
  if (partialPayments.length > 0) {
    edgeCases.push({
      title: '📉 PARTIAL PAYMENTS',
      description: 'Invoices with partial payments - may have multiple payment installments',
      count: partialPayments.length,
    });
  }

  // Find high confidence matches (ambiguous)
  const highConfidence = matches.filter((m) => m.match_type === 'high_confidence_match');
  if (highConfidence.length > 0) {
    edgeCases.push({
      title: '🎯 HIGH CONFIDENCE (NO INVOICE #)',
      description:
        'Matched by amount and name only - single invoice found matching criteria',
      count: highConfidence.length,
    });
  }

  // Find exact amount with multiple possibilities
  const exactAmount = matches.filter((m) => m.match_type === 'exact_amount_payer');
  if (exactAmount.length > 0) {
    edgeCases.push({
      title: '📊 EXACT AMOUNT (MULTIPLE POSSIBLE)',
      description: 'Matched by amount and payer - multiple invoices may exist for this amount',
      count: exactAmount.length,
    });
  }

  if (edgeCases.length === 0) {
    console.log('\n   No edge cases detected - all matches are straightforward.');
  } else {
    edgeCases.forEach((edge) => {
      console.log(`\n   ${edge.title}`);
      console.log(`   Count: ${edge.count}`);
      console.log(`   Note: ${edge.description}`);
    });
  }
}

// Run the test
testDirectMatching();
