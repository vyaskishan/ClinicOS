import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { learnPatternFromMatch } from '../services/pattern-learning.service';

/**
 * MATCH MANAGEMENT API ROUTES
 *
 * Purpose: Handle manual match creation and pattern learning.
 *
 * Endpoints:
 * - POST /api/matches/manual - Create manual match between payment and invoice
 * - PUT /api/matches/:id/confirm - Confirm a pending match
 * - PUT /api/matches/:id/reject - Reject a match
 * - GET /api/matches - List all matches with filters
 */

const router = Router();

/**
 * POST /api/matches/manual
 *
 * Create a manual match between a payment and invoice.
 *
 * Request Body:
 * {
 *   "payment_id": "uuid",
 *   "invoice_id": "uuid",
 *   "reason": "string", // Required: why user is creating this match
 *   "notes": "string", // Optional: additional notes
 *   "learn_pattern": true // Default: true - whether to learn pattern from this match
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "match": {
 *     "id": "uuid",
 *     "payment_id": "uuid",
 *     "invoice_id": "uuid",
 *     "match_type": "manual",
 *     "match_confidence": 100,
 *     "status": "confirmed",
 *     "is_manual": true
 *   },
 *   "pattern_learned": {
 *     "id": "uuid",
 *     "pattern": "PHAU | Private Health Australia",
 *     "confidence": 85
 *   }
 * }
 */
router.post('/manual', async (req: Request, res: Response) => {
  // client definition
  const client = await pool.connect();

  try {
    // Validate input
    const { payment_id, invoice_id, reason, notes, learn_pattern = true } = req.body;

    if (!payment_id || !invoice_id) {
      return res.status(400).json({
        success: false,
        error: 'payment_id and invoice_id are required',
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'reason is required for manual matches',
      });
    }

    console.log(`📝 Manual match request: payment ${payment_id} → invoice ${invoice_id}`);

    await client.query('BEGIN');

    // 1. Validate payment and invoice exist
    const paymentResult = await client.query(
      `SELECT * FROM payments WHERE id = $1`,
      [payment_id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    const payment = paymentResult.rows[0];

    const invoiceResult = await client.query(
      `SELECT * FROM invoices WHERE id = $1`,
      [invoice_id]
    );

    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    const invoice = invoiceResult.rows[0];

    // 2. Check if payment or invoice are already matched
    const existingMatchCheck = await client.query(
      `
      SELECT * FROM matches
      WHERE (payment_id = $1 OR invoice_id = $2)
        AND status = 'confirmed'
      LIMIT 1
    `,
      [payment_id, invoice_id]
    );

    if (existingMatchCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'Payment or invoice is already matched',
      });
    }

    // 3. Create match record
    const matchResult = await client.query(
      `
      INSERT INTO matches (
        payment_id,
        invoice_id,
        match_type,
        match_confidence,
        amount_matched,
        status,
        is_manual,
        notes,
        confirmed_by,
        confirmed_at
      ) VALUES ($1, $2, 'manual', 100, $3, 'confirmed', true, $4, 'manual_user', CURRENT_TIMESTAMP)
      RETURNING *
    `,
      [
        payment_id,
        invoice_id,
        payment.amount, // amount_matched = full payment amount
        `${reason}${notes ? '. ' + notes : ''}`,
      ]
    );

    const match = matchResult.rows[0];

    console.log(`✅ Created manual match ${match.id}`);

    // 4. Update invoice status
    const newOutstandingAmount = invoice.outstanding_amount - payment.amount;
    let newInvoiceStatus = invoice.status;

    if (newOutstandingAmount <= 0) {
      newInvoiceStatus = 'paid';
    } else if (newOutstandingAmount < invoice.amount) {
      newInvoiceStatus = 'partially_paid';
    }

    await client.query(
      `
      UPDATE invoices
      SET amount_matched = COALESCE(amount_matched, 0) + $1,
          outstanding_amount = $2,
          status = $3
      WHERE id = $4
    `,
      [payment.amount, newOutstandingAmount, newInvoiceStatus, invoice_id]
    );

    console.log(`📊 Updated invoice ${invoice_id}: status=${newInvoiceStatus}, outstanding=$${newOutstandingAmount}`);

    // 5. Update payment status
    await client.query(
      `
      UPDATE payments
      SET status = 'matched'
      WHERE id = $1
    `,
      [payment_id]
    );

    console.log(`💰 Updated payment ${payment_id}: status=matched`);

    // 6. Learn pattern (if requested)
    let learnedPattern = null;

    if (learn_pattern) {
      try {
        const pattern = await learnPatternFromMatch(
          client,
          payment.description || '',
          invoice.payee_name || '',
          invoice.patient_name || null,
          match.id
        );

        if (pattern) {
          learnedPattern = {
            id: pattern.id,
            pattern: pattern.bank_description_pattern,
            confidence: 100, // New patterns start at 100% success rate
          };

          console.log(`🧠 Learned pattern: "${pattern.bank_description_pattern}" → "${pattern.payee_name}"`);
        }
      } catch (error) {
        console.error('⚠️ Failed to learn pattern (non-critical):', error);
        // Don't fail the entire request if pattern learning fails
      }
    }

    // 7. Create audit log entry
    await client.query(
      `
      INSERT INTO reconciliation_audit (
        action,
        entity_type,
        entity_id,
        details,
        performed_by
      ) VALUES ('manual_match_created', 'match', $1, $2, 'manual_user')
    `,
      [
        match.id,
        JSON.stringify({
          payment_id,
          invoice_id,
          reason,
          notes,
          pattern_learned: !!learnedPattern,
          pattern_id: learnedPattern?.id,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Manual match created successfully',
      match: {
        id: match.id,
        payment_id: match.payment_id,
        invoice_id: match.invoice_id,
        match_type: match.match_type,
        match_confidence: match.match_confidence,
        amount_matched: match.amount_matched,
        status: match.status,
        is_manual: match.is_manual,
        notes: match.notes,
        matched_at: match.matched_at,
      },
      pattern_learned: learnedPattern,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Manual match creation failed:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to create manual match',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/matches/:id/confirm
 *
 * Confirm a pending match.
 *
 * Request Body:
 * {
 *   "notes": "string" // Optional: reason for confirmation
 * }
 */
router.put('/:id/confirm', async (req: Request, res: Response) => {
  // client definition
  const client = await pool.connect();

  try {
    const matchId = req.params.id;
    const { notes } = req.body;

    console.log(`✅ Confirming match ${matchId}`);

    await client.query('BEGIN');

    // Get match details
    const matchResult = await client.query(
      `SELECT * FROM matches WHERE id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Match not found',
      });
    }

    const match = matchResult.rows[0];

    if (match.status === 'confirmed') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Match is already confirmed',
      });
    }

    // Update match status
    await client.query(
      `
      UPDATE matches
      SET status = 'confirmed',
          confirmed_by = 'user',
          confirmed_at = CURRENT_TIMESTAMP,
          notes = COALESCE(notes, '') || $1
      WHERE id = $2
    `,
      [notes ? `. Confirmed: ${notes}` : '', matchId]
    );

    // Update payment status
    await client.query(
      `UPDATE payments SET status = 'matched' WHERE id = $1`,
      [match.payment_id]
    );

    // Update invoice status
    const invoiceResult = await client.query(
      `SELECT * FROM invoices WHERE id = $1`,
      [match.invoice_id]
    );

    const invoice = invoiceResult.rows[0];
    const newOutstandingAmount = invoice.outstanding_amount - match.amount_matched;

    let newStatus = invoice.status;
    if (newOutstandingAmount <= 0) {
      newStatus = 'paid';
    } else if (newOutstandingAmount < invoice.amount) {
      newStatus = 'partially_paid';
    }

    await client.query(
      `
      UPDATE invoices
      SET amount_matched = COALESCE(amount_matched, 0) + $1,
          outstanding_amount = $2,
          status = $3
      WHERE id = $4
    `,
      [match.amount_matched, newOutstandingAmount, newStatus, match.invoice_id]
    );

    // Create audit log
    await client.query(
      `
      INSERT INTO reconciliation_audit (
        action,
        entity_type,
        entity_id,
        details,
        performed_by
      ) VALUES ('match_confirmed', 'match', $1, $2, 'user')
    `,
      [matchId, JSON.stringify({ notes })]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Match confirmed successfully',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Match confirmation failed:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to confirm match',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/matches/:id/reject
 *
 * Reject a match.
 *
 * Request Body:
 * {
 *   "reason": "string" // Required: why match is being rejected
 * }
 */
router.put('/:id/reject', async (req: Request, res: Response) => {
  // pool imported at top
  // client definition
  const client = await pool.connect();

  try {
    const matchId = req.params.id;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'reason is required for rejecting a match',
      });
    }

    console.log(`❌ Rejecting match ${matchId}: ${reason}`);

    await client.query('BEGIN');

    // Get match details
    const matchResult = await client.query(
      `SELECT * FROM matches WHERE id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Match not found',
      });
    }

    const match = matchResult.rows[0];

    // Update match status
    await client.query(
      `
      UPDATE matches
      SET status = 'rejected',
          confirmed_by = 'user',
          confirmed_at = CURRENT_TIMESTAMP,
          notes = COALESCE(notes, '') || $1
      WHERE id = $2
    `,
      [`. Rejected: ${reason}`, matchId]
    );

    // Revert payment status to unmatched
    await client.query(
      `UPDATE payments SET status = 'unmatched' WHERE id = $1`,
      [match.payment_id]
    );

    // Create audit log
    await client.query(
      `
      INSERT INTO reconciliation_audit (
        action,
        entity_type,
        entity_id,
        details,
        performed_by
      ) VALUES ('match_rejected', 'match', $1, $2, 'user')
    `,
      [matchId, JSON.stringify({ reason })]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Match rejected successfully',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Match rejection failed:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to reject match',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/matches
 *
 * List all matches with filters.
 *
 * Query params:
 * - status: confirmed|pending|rejected
 * - is_manual: true|false
 * - payment_id: uuid
 * - invoice_id: uuid
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
router.get('/', async (req: Request, res: Response) => {
  // pool imported at top
  // client definition
  const client = await pool.connect();

  try {
    const { status, is_manual, payment_id, invoice_id, limit = 50, offset = 0 } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`m.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (is_manual !== undefined) {
      conditions.push(`m.is_manual = $${paramIndex}`);
      params.push(is_manual === 'true');
      paramIndex++;
    }

    if (payment_id) {
      conditions.push(`m.payment_id = $${paramIndex}`);
      params.push(payment_id);
      paramIndex++;
    }

    if (invoice_id) {
      conditions.push(`m.invoice_id = $${paramIndex}`);
      params.push(invoice_id);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM matches m ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count, 10);

    // Get matches
    const result = await client.query(
      `
      SELECT
        m.*,
        p.description as payment_description,
        p.amount as payment_amount,
        p.date as payment_date,
        i.invoice_number,
        i.payee_name,
        i.amount as invoice_amount
      FROM matches m
      JOIN payments p ON m.payment_id = p.id
      JOIN invoices i ON m.invoice_id = i.id
      ${whereClause}
      ORDER BY m.matched_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
      [...params, limit, offset]
    );

    return res.json({
      success: true,
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      matches: result.rows,
    });
  } catch (error: any) {
    console.error('❌ Failed to list matches:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to list matches',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

export default router;
