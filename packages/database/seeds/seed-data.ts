import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'reconx_dev',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

/**
 * Seed development data for ReconX
 *
 * WARNING: This will delete existing data!
 *
 * Creates:
 * - 10 sample invoices (mix of paid/unpaid)
 * - 8 sample payments (including 2 auto-reconciled)
 * - 3 sample remittances with payment codes
 * - 5 sample payer aliases
 */
async function seed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting ReconX database seeding...\n');

    await client.query('BEGIN');

    // Clear existing data (in reverse order of dependencies)
    console.log('🧹 Clearing existing data...');
    await client.query('DELETE FROM reconciliation_audit');
    await client.query('DELETE FROM manual_match_patterns');
    await client.query('DELETE FROM matches');
    await client.query('DELETE FROM remittances');
    await client.query('DELETE FROM payments');
    await client.query('DELETE FROM invoices');
    await client.query('DELETE FROM payer_aliases');
    console.log('   ✅ Existing data cleared\n');

    // 1. Seed Payer Aliases
    console.log('👥 Seeding payer aliases...');
    const payerAliases = [
      { canonical: 'Medicare Australia', alias: 'MEDICARE' },
      { canonical: 'Medicare Australia', alias: 'Medicare' },
      { canonical: 'Medicare Australia', alias: 'Med Aus' },
      { canonical: 'Medibank Private', alias: 'MEDIBANK' },
      { canonical: 'Medibank Private', alias: 'Medibank' },
      { canonical: 'Medibank Private', alias: 'MBK' },
      { canonical: 'BUPA Health Insurance', alias: 'BUPA' },
      { canonical: 'BUPA Health Insurance', alias: 'Bupa' },
      { canonical: 'HCF Health Insurance', alias: 'HCF' },
      { canonical: 'HCF Health Insurance', alias: 'Health Care Fund' },
      { canonical: 'Department of Veterans Affairs', alias: 'DVA' },
      { canonical: 'Department of Veterans Affairs', alias: 'Veterans Affairs' },
    ];

    for (const alias of payerAliases) {
      await client.query(
        `INSERT INTO payer_aliases (canonical_name, alias_name)
         VALUES ($1, $2)`,
        [alias.canonical, alias.alias]
      );
    }
    console.log(`   ✅ Created ${payerAliases.length} payer aliases\n`);

    // 2. Seed Invoices
    console.log('📄 Seeding invoices...');
    const invoices = [
      // Unpaid invoices
      {
        invoice_number: 'INV001',
        invoice_date: '2024-01-15',
        patient_name: 'John Smith',
        payee_name: 'Medicare Australia',
        amount: 150.00,
        outstanding_amount: 150.00,
        description: 'General consultation',
        status: 'unpaid',
      },
      {
        invoice_number: 'INV002',
        invoice_date: '2024-01-18',
        patient_name: 'Sarah Johnson',
        payee_name: 'Medibank Private',
        amount: 250.50,
        outstanding_amount: 250.50,
        description: 'Specialist consultation',
        status: 'unpaid',
      },
      {
        invoice_number: 'INV003',
        invoice_date: '2024-01-20',
        patient_name: 'Michael Brown',
        payee_name: 'BUPA Health Insurance',
        amount: 180.00,
        outstanding_amount: 180.00,
        description: 'X-ray imaging',
        status: 'unpaid',
      },
      {
        invoice_number: 'INV004',
        invoice_date: '2024-01-22',
        patient_name: 'Emma Wilson',
        payee_name: 'HCF Health Insurance',
        amount: 95.00,
        outstanding_amount: 95.00,
        description: 'Follow-up consultation',
        status: 'unpaid',
      },
      {
        invoice_number: 'INV005',
        invoice_date: '2024-01-25',
        patient_name: 'David Lee',
        payee_name: 'Department of Veterans Affairs',
        amount: 200.00,
        outstanding_amount: 200.00,
        description: 'Medical assessment',
        status: 'unpaid',
      },
      // Partially paid invoices
      {
        invoice_number: 'INV006',
        invoice_date: '2024-01-10',
        patient_name: 'Lisa Anderson',
        payee_name: 'Medicare Australia',
        amount: 300.00,
        outstanding_amount: 150.00,
        description: 'Surgery consultation',
        status: 'partially_paid',
      },
      {
        invoice_number: 'INV007',
        invoice_date: '2024-01-12',
        patient_name: 'Robert Taylor',
        payee_name: 'Medibank Private',
        amount: 450.00,
        outstanding_amount: 100.00,
        description: 'Comprehensive health check',
        status: 'partially_paid',
      },
      // Fully paid invoices
      {
        invoice_number: 'INV008',
        invoice_date: '2024-01-05',
        patient_name: 'Jennifer White',
        payee_name: 'Medicare Australia',
        amount: 120.00,
        outstanding_amount: 0.00,
        description: 'General consultation',
        status: 'fully_paid',
      },
      {
        invoice_number: 'INV009',
        invoice_date: '2024-01-08',
        patient_name: 'Christopher Martin',
        payee_name: 'BUPA Health Insurance',
        amount: 175.00,
        outstanding_amount: 0.00,
        description: 'Blood test',
        status: 'fully_paid',
      },
      {
        invoice_number: 'INV010',
        invoice_date: '2024-01-09',
        patient_name: 'Amanda Garcia',
        payee_name: 'Department of Veterans Affairs',
        amount: 220.00,
        outstanding_amount: 0.00,
        description: 'Physiotherapy session',
        status: 'fully_paid',
      },
    ];

    const invoiceIds: { [key: string]: string } = {};
    for (const invoice of invoices) {
      const result = await client.query(
        `INSERT INTO invoices (invoice_number, invoice_date, patient_name, payee_name, amount, outstanding_amount, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          invoice.invoice_number,
          invoice.invoice_date,
          invoice.patient_name,
          invoice.payee_name,
          invoice.amount,
          invoice.outstanding_amount,
          invoice.description,
          invoice.status,
        ]
      );
      invoiceIds[invoice.invoice_number] = result.rows[0].id;
    }
    console.log(`   ✅ Created ${invoices.length} invoices\n`);

    // 3. Seed Payments
    console.log('💰 Seeding payments...');
    const payments = [
      // Regular bank feed payments (unmatched)
      {
        payment_date: '2024-01-16',
        amount: 150.00,
        description: 'BPAY MEDICARE 12345',
        auto_reconciled: false,
        auto_reconciled_source: null,
        status: 'unmatched',
      },
      {
        payment_date: '2024-01-19',
        amount: 250.50,
        description: 'INTERNET TRANSFER MEDIBANK',
        auto_reconciled: false,
        auto_reconciled_source: null,
        status: 'unmatched',
      },
      {
        payment_date: '2024-01-21',
        amount: 180.00,
        description: 'DIRECT CREDIT BUPA HEALTH',
        auto_reconciled: false,
        auto_reconciled_source: null,
        status: 'unmatched',
      },
      {
        payment_date: '2024-01-23',
        amount: 95.00,
        description: 'PAYMENT FROM HCF',
        auto_reconciled: false,
        auto_reconciled_source: null,
        status: 'unmatched',
      },
      // Auto-reconciled payments (Tyro and Medicare EasyClaim)
      {
        payment_date: '2024-01-11',
        amount: 150.00,
        description: 'TYRO EFTPOS PAYMENT - INV006',
        auto_reconciled: true,
        auto_reconciled_source: 'TYRO',
        status: 'auto_reconciled',
      },
      {
        payment_date: '2024-01-13',
        amount: 350.00,
        description: 'MEDICARE EASYCLAIM - INV007',
        auto_reconciled: true,
        auto_reconciled_source: 'MEDICARE_EASYCLAIM',
        status: 'auto_reconciled',
      },
      // Matched payments
      {
        payment_date: '2024-01-06',
        amount: 120.00,
        description: 'MEDICARE BULK BILL',
        auto_reconciled: false,
        auto_reconciled_source: null,
        status: 'matched',
      },
      {
        payment_date: '2024-01-10',
        amount: 220.00,
        description: 'DVA PAYMENT',
        auto_reconciled: false,
        auto_reconciled_source: null,
        status: 'matched',
      },
    ];

    const paymentIds: string[] = [];
    for (const payment of payments) {
      const result = await client.query(
        `INSERT INTO payments (payment_date, amount, description, auto_reconciled, auto_reconciled_source, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          payment.payment_date,
          payment.amount,
          payment.description,
          payment.auto_reconciled,
          payment.auto_reconciled_source,
          payment.status,
        ]
      );
      paymentIds.push(result.rows[0].id);
    }
    console.log(`   ✅ Created ${payments.length} payments (2 auto-reconciled)\n`);

    // 4. Seed Remittances
    console.log('📋 Seeding remittances...');
    const remittances = [
      {
        filename: 'medicare_remittance_20240116.csv',
        file_path: '/uploads/remittances/medicare_remittance_20240116.csv',
        email_date: '2024-01-16',
        payer_name: 'Medicare Australia',
        payment_code: 'MED20240116001',
        total_amount: 150.00,
        parsed_content: {
          line_items: [
            {
              invoice_ref: 'INV001',
              patient: 'John Smith',
              service_date: '2024-01-15',
              amount: 150.00,
              item_number: '23',
            },
          ],
        },
      },
      {
        filename: 'medibank_remittance_20240119.pdf',
        file_path: '/uploads/remittances/medibank_remittance_20240119.pdf',
        email_date: '2024-01-19',
        payer_name: 'Medibank Private',
        payment_code: 'MBK2024011900542',
        total_amount: 250.50,
        parsed_content: {
          line_items: [
            {
              claim_number: 'INV002',
              patient: 'Sarah Johnson',
              service_date: '2024-01-18',
              amount_billed: 250.50,
              amount_paid: 250.50,
            },
          ],
        },
      },
      {
        filename: 'dva_remittance_20240123.csv',
        file_path: '/uploads/remittances/dva_remittance_20240123.csv',
        email_date: '2024-01-23',
        payer_name: 'Department of Veterans Affairs',
        payment_code: 'DVA-2024-001-789',
        total_amount: 200.00,
        parsed_content: {
          line_items: [
            {
              invoice_number: 'INV005',
              veteran_name: 'David Lee',
              service_date: '2024-01-25',
              approved_amount: 200.00,
            },
          ],
        },
      },
    ];

    for (const remittance of remittances) {
      await client.query(
        `INSERT INTO remittances (filename, file_path, email_date, payer_name, payment_code, total_amount, parsed_content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          remittance.filename,
          remittance.file_path,
          remittance.email_date,
          remittance.payer_name,
          remittance.payment_code,
          remittance.total_amount,
          JSON.stringify(remittance.parsed_content),
        ]
      );
    }
    console.log(`   ✅ Created ${remittances.length} remittances\n`);

    await client.query('COMMIT');

    console.log('✨ Database seeding completed successfully!\n');
    console.log('📊 Seeded data summary:');
    console.log(`   - Payer Aliases: ${payerAliases.length}`);
    console.log(`   - Invoices: ${invoices.length} (5 unpaid, 2 partially paid, 3 fully paid)`);
    console.log(`   - Payments: ${payments.length} (4 unmatched, 2 auto-reconciled, 2 matched)`);
    console.log(`   - Remittances: ${remittances.length}`);
    console.log('\n🎯 Ready for reconciliation testing!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run seed if called directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default seed;
