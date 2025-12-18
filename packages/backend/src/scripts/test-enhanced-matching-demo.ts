/**
 * TEST SCRIPT: Enhanced Multi-Field Matching Demo
 *
 * Purpose: Demonstrate enhanced fuzzy matching with:
 * - Bank description tokenization and noise filtering
 * - Multi-field matching (payer name, patient name, email domain, transaction ID)
 * - Improved scoring that uses the best matching field
 *
 * This demonstrates how the system handles real-world bank descriptions with lots of noise.
 */

import {
  extractAllData,
  extractEmailDomains,
  extractTransactionIds,
} from '../utils/text-extraction.utils';
import * as fuzzball from 'fuzzball';

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 ENHANCED MULTI-FIELD MATCHING DEMONSTRATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// =============================================================================
// SECTION 1: BANK DESCRIPTION PARSING
// =============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 SECTION 1: BANK DESCRIPTION PARSING & EXTRACTION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const noisyBankDescriptions = [
  {
    name: 'Medicare Payment with Transaction ID',
    description:
      'EFT CREDIT MEDICARE AUSTRALIA PATIENT JOHN SMITH REF MCARE2024012001 support@medicare.gov.au PAYMENT FOR SERVICES',
  },
  {
    name: 'DVA Payment with Patient Name',
    description:
      'DIRECT DEPOSIT DVA DEPT VETERANS AFFAIRS CLAIM FOR ROBERT WILSON TXN DVA20240122 vetpayments@dva.gov.au',
  },
  {
    name: 'Private Health Fund Payment',
    description:
      'BPAY CREDIT MEDIBANK PRIVATE HEALTH INSURANCE EMMA DAVIS REF PHI-2024-789 claims@medibank.com.au APPROVED',
  },
];

noisyBankDescriptions.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.name}`);
  console.log(`   Original: "${item.description}"\n`);

  const extracted = extractAllData(item.description);

  console.log('   📧 Email Domains Extracted:');
  extracted.email_domains.forEach((domain) => console.log(`      - ${domain}`));

  console.log('\n   🔢 Transaction IDs Extracted:');
  extracted.transaction_ids.forEach((id) => console.log(`      - ${id}`));

  console.log('\n   👤 Person Names Extracted:');
  extracted.person_names.forEach((name) => console.log(`      - ${name}`));

  console.log('\n   🏢 Organization Names Extracted:');
  extracted.organization_names.forEach((org) => console.log(`      - ${org}`));

  console.log('\n   🧹 Cleaned Keywords (noise removed):');
  console.log(`      ${extracted.keywords.join(', ')}\n`);

  console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// =============================================================================
// SECTION 2: MULTI-FIELD FUZZY MATCHING
// =============================================================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 SECTION 2: MULTI-FIELD FUZZY MATCHING');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

interface TestPayment {
  id: string;
  description: string;
  amount: number;
  date: string;
}

interface TestInvoice {
  id: string;
  invoice_number: string;
  payee_name: string;
  patient_name?: string;
  patient_email?: string;
  amount: number;
  date: string;
}

const payments: TestPayment[] = [
  {
    id: 'pay-001',
    description:
      'EFT CREDIT MEDICARE AUSTRALIA PATIENT JOHN SMITH REF MCARE2024012001 support@medicare.gov.au',
    amount: 450.0,
    date: '2024-01-20',
  },
  {
    id: 'pay-002',
    description:
      'DIRECT DEPOSIT DVA CLAIM FOR ROBERT WILSON TXN DVA20240122 vetpayments@dva.gov.au',
    amount: 300.0,
    date: '2024-01-19',
  },
  {
    id: 'pay-003',
    description:
      'BPAY MEDIBANK PRIVATE EMMA DAVIS REF PHI-2024-789 claims@medibank.com.au',
    amount: 150.0,
    date: '2024-01-21',
  },
];

const invoices: TestInvoice[] = [
  {
    id: 'inv-001',
    invoice_number: 'MCARE2024012001',
    payee_name: 'Medicare Australia',
    patient_name: 'John Smith',
    patient_email: 'john.smith@email.com',
    amount: 450.0,
    date: '2024-01-20',
  },
  {
    id: 'inv-002',
    invoice_number: '240102',
    payee_name: 'Department of Veterans Affairs',
    patient_name: 'Robert Wilson',
    patient_email: 'robert.w@email.com',
    amount: 300.0,
    date: '2024-01-19',
  },
  {
    id: 'inv-003',
    invoice_number: '240103',
    payee_name: 'Medibank Private',
    patient_name: 'Emma Davis',
    patient_email: 'emma.davis@email.com',
    amount: 150.0,
    date: '2024-01-21',
  },
];

console.log('📊 Running Multi-Field Matching...\n');

payments.forEach((payment, idx) => {
  console.log(`\n${idx + 1}. Payment ${payment.id}`);
  console.log(`   Description: "${payment.description}"`);
  console.log(`   Amount: $${payment.amount.toFixed(2)} | Date: ${payment.date}\n`);

  // Extract data from payment
  const paymentData = extractAllData(payment.description);

  // Find best match across all invoices
  let bestMatch: any = null;
  let bestScore = 0;
  let bestMatchDetails: any = null;

  invoices.forEach((invoice) => {
    // Extract data from invoice
    const invoiceEmailDomains = extractEmailDomains(
      `${invoice.patient_email || ''} @${invoice.payee_name.toLowerCase().replace(/\s+/g, '')}.com.au`
    );
    const invoiceTransactionIds = extractTransactionIds(invoice.invoice_number);

    // 1. Payer name matching
    const payerSimilarity = fuzzball.token_sort_ratio(
      payment.description,
      invoice.payee_name
    );

    // 2. Patient name matching
    let patientSimilarity = 0;
    if (paymentData.person_names.length > 0 && invoice.patient_name) {
      paymentData.person_names.forEach((paymentName) => {
        const similarity = fuzzball.token_sort_ratio(paymentName, invoice.patient_name!);
        patientSimilarity = Math.max(patientSimilarity, similarity);
      });
    }

    // 3. Email domain matching
    const emailDomainMatch =
      paymentData.email_domains.length > 0 &&
      paymentData.email_domains.some((pd) =>
        invoiceEmailDomains.some((id) => id.includes(pd) || pd.includes(id))
      );

    // 4. Transaction ID matching
    const transactionIdMatch =
      paymentData.transaction_ids.length > 0 &&
      paymentData.transaction_ids.some((pt) =>
        invoiceTransactionIds.some((it) => it === pt || invoice.invoice_number.includes(pt))
      );

    // Calculate best field match
    const nameSimilarity = Math.max(payerSimilarity, patientSimilarity);
    let score = (nameSimilarity / 100) * 40;

    let bestField = '';
    if (patientSimilarity > payerSimilarity) {
      bestField = 'patient_name';
    } else if (payerSimilarity > 0) {
      bestField = 'payer_name';
    }

    // Apply bonuses
    if (emailDomainMatch) {
      score += 5;
      bestField = bestField || 'email_domain';
    }

    if (transactionIdMatch) {
      score += 10;
      bestField = 'transaction_id';
    }

    // Cap at 50
    score = Math.min(score, 50);

    // Add amount and date scores (simplified for demo)
    const amountDiff = Math.abs(payment.amount - invoice.amount);
    const amountScore = amountDiff <= 10 ? 30 : 0;

    const dateDiff = Math.abs(
      Math.floor(
        (new Date(payment.date).getTime() - new Date(invoice.date).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
    const dateScore = dateDiff === 0 ? 20 : dateDiff <= 7 ? 15 : 0;

    const totalScore = score + amountScore + dateScore;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = invoice;
      bestMatchDetails = {
        payerSimilarity,
        patientSimilarity,
        emailDomainMatch,
        transactionIdMatch,
        nameSimilarity,
        bestField,
        nameScore: score,
        amountScore,
        dateScore,
        totalScore,
      };
    }
  });

  if (bestMatch) {
    console.log(`   ✅ BEST MATCH: Invoice ${bestMatch.invoice_number} - "${bestMatch.payee_name}"`);
    console.log(`   📊 Total Score: ${bestMatchDetails.totalScore.toFixed(1)}%\n`);

    console.log('   Multi-Field Analysis:');
    console.log(`      🏢 Payer Name Match: ${bestMatchDetails.payerSimilarity}%`);
    console.log(`      👤 Patient Name Match: ${bestMatchDetails.patientSimilarity}%`);
    console.log(
      `      📧 Email Domain Match: ${bestMatchDetails.emailDomainMatch ? 'YES ✓' : 'NO'}`
    );
    console.log(
      `      🔢 Transaction ID Match: ${bestMatchDetails.transactionIdMatch ? 'YES ✓' : 'NO'}`
    );
    console.log(`      🎯 Best Field Matched: ${bestMatchDetails.bestField.toUpperCase()}\n`);

    console.log('   Component Scores:');
    console.log(`      Name/Field Score: ${bestMatchDetails.nameScore.toFixed(1)} points`);
    console.log(`      Amount Score: ${bestMatchDetails.amountScore} points`);
    console.log(`      Date Score: ${bestMatchDetails.dateScore} points`);
    console.log(`      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`      Total: ${bestMatchDetails.totalScore.toFixed(1)}%`);
  } else {
    console.log('   ❌ No match found');
  }

  console.log('\n   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// =============================================================================
// SUMMARY
// =============================================================================

console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📈 ENHANCEMENT SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('✅ Key Enhancements Demonstrated:\n');

console.log('1. 🧹 NOISE FILTERING:');
console.log('   - Removes common words: "EFT", "PAYMENT", "CREDIT", "TRANSFER", etc.');
console.log('   - Extracts only meaningful keywords');
console.log('   - Improves matching accuracy by reducing false positives\n');

console.log('2. 📧 EMAIL DOMAIN EXTRACTION:');
console.log('   - Automatically extracts email domains from descriptions');
console.log('   - Matches against invoice patient email domains');
console.log('   - Provides +5 bonus points for exact domain match\n');

console.log('3. 🔢 TRANSACTION ID MATCHING:');
console.log('   - Extracts various ID patterns:');
console.log('     * REF codes (REF123, MCARE2024012001)');
console.log('     * Transaction IDs (TXN123, DVA20240122)');
console.log('     * Alphanumeric codes (PHI-2024-789)');
console.log('   - Provides +10 bonus points for exact ID match\n');

console.log('4. 👤 PATIENT NAME EXTRACTION:');
console.log('   - Identifies person names in bank descriptions');
console.log('   - Matches against invoice patient names');
console.log('   - Uses best match between payer and patient names\n');

console.log('5. 🎯 MULTI-FIELD SCORING:');
console.log('   - Compares payment against MULTIPLE invoice fields');
console.log('   - Uses the BEST matching field for scoring');
console.log('   - Provides detailed breakdown of which field matched\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 REAL-WORLD BENEFITS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Before Enhancement:');
console.log('  ❌ Bank description: "EFT CREDIT MEDICARE AUSTRALIA PATIENT JOHN SMITH REF MCARE2024012001"');
console.log('  ❌ Compared entire string against "Medicare Australia"');
console.log('  ❌ Low match score due to extra words\n');

console.log('After Enhancement:');
console.log('  ✅ Extracts: Transaction ID "MCARE2024012001"');
console.log('  ✅ Matches against invoice number');
console.log('  ✅ High confidence match (+10 bonus)\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('💡 Next Steps:');
console.log('   1. Build: npm run build');
console.log('   2. Run this demo: npm run test:enhanced-demo');
console.log('   3. Test with live database: POST /api/reconcile/fuzzy\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
