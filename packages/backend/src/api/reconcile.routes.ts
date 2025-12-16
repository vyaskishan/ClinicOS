import { Router, Request, Response } from 'express';
import {
  runDirectMatching,
  DirectMatchOptions,
} from '../services/direct-matching.service';

/**
 * RECONCILIATION API ROUTES
 *
 * Purpose: Handle invoice-payment reconciliation endpoints.
 *
 * Endpoints:
 * - POST /api/reconcile/direct - Run Level 1: Direct/Exact Matching
 */

const router = Router();

/**
 * POST /api/reconcile/direct
 *
 * Run Level 1: Direct/Exact Matching algorithm
 *
 * Request Body:
 * {
 *   "invoice_ids": ["uuid1", "uuid2"], // Optional: specific invoices
 *   "payment_ids": ["uuid3", "uuid4"], // Optional: specific payments
 *   "exclude_auto_reconciled": true,   // Default: true
 *   "auto_confirm_perfect_matches": false // Default: false
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "summary": {
 *     "total_matches": 15,
 *     "by_type": {
 *       "perfect_match": 8,
 *       "partial_payment": 3,
 *       "overpaid": 1,
 *       "high_confidence_match": 2,
 *       "exact_amount_payer": 1
 *     },
 *     "auto_confirmed": 8,
 *     "requires_review": 7
 *   },
 *   "matches": [
 *     {
 *       "match_id": "uuid",
 *       "payment_id": "uuid",
 *       "invoice_id": "uuid",
 *       "match_type": "perfect_match",
 *       "confidence": 100,
 *       "amount_matched": 150.00,
 *       "requires_review": false,
 *       "details": {
 *         "reason": "Invoice number and exact amount match",
 *         "matched_fields": ["invoice_number", "amount"],
 *         "name_similarity": 95.5,
 *         "amount_difference": 0
 *       }
 *     }
 *   ]
 * }
 */
router.post('/direct', async (req: Request, res: Response) => {
  try {
    const options: DirectMatchOptions = {
      invoice_ids: req.body.invoice_ids,
      payment_ids: req.body.payment_ids,
      exclude_auto_reconciled:
        req.body.exclude_auto_reconciled !== undefined
          ? req.body.exclude_auto_reconciled
          : true,
      auto_confirm_perfect_matches: req.body.auto_confirm_perfect_matches || false,
    };

    console.log('📥 Direct matching request received');
    console.log(`   Options:`, options);

    // Run direct matching algorithm
    const result = await runDirectMatching(options);

    return res.json({
      success: true,
      message: `Direct matching completed: ${result.total_matches} matches found`,
      summary: {
        total_matches: result.total_matches,
        by_type: result.by_type,
        auto_confirmed: result.auto_confirmed,
        requires_review: result.requires_review,
      },
      matches: result.matches,
    });
  } catch (error: any) {
    console.error('Error running direct matching:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'MATCHING_ERROR',
        message: error.message || 'Failed to run direct matching',
      },
    });
  }
});

/**
 * GET /api/reconcile/stats
 *
 * Get reconciliation statistics
 *
 * Response:
 * {
 *   "invoices": {
 *     "total": 100,
 *     "unpaid": 25,
 *     "partially_paid": 15,
 *     "fully_paid": 60
 *   },
 *   "payments": {
 *     "total": 80,
 *     "unmatched": 20,
 *     "matched": 50,
 *     "auto_reconciled": 10
 *   },
 *   "matches": {
 *     "total": 65,
 *     "pending": 15,
 *     "confirmed": 45,
 *     "rejected": 5
 *   }
 * }
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const { query: db } = await import('../config/database');

    // Get invoice stats
    const invoiceStats = await db(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'unpaid') as unpaid,
        COUNT(*) FILTER (WHERE status = 'partially_paid') as partially_paid,
        COUNT(*) FILTER (WHERE status = 'fully_paid') as fully_paid
      FROM invoices
    `);

    // Get payment stats
    const paymentStats = await db(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'unmatched') as unmatched,
        COUNT(*) FILTER (WHERE status = 'matched') as matched,
        COUNT(*) FILTER (WHERE auto_reconciled = TRUE) as auto_reconciled
      FROM payments
    `);

    // Get match stats
    const matchStats = await db(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected
      FROM matches
    `);

    return res.json({
      success: true,
      stats: {
        invoices: {
          total: parseInt(invoiceStats.rows[0].total),
          unpaid: parseInt(invoiceStats.rows[0].unpaid),
          partially_paid: parseInt(invoiceStats.rows[0].partially_paid),
          fully_paid: parseInt(invoiceStats.rows[0].fully_paid),
        },
        payments: {
          total: parseInt(paymentStats.rows[0].total),
          unmatched: parseInt(paymentStats.rows[0].unmatched),
          matched: parseInt(paymentStats.rows[0].matched),
          auto_reconciled: parseInt(paymentStats.rows[0].auto_reconciled),
        },
        matches: {
          total: parseInt(matchStats.rows[0].total),
          pending: parseInt(matchStats.rows[0].pending),
          confirmed: parseInt(matchStats.rows[0].confirmed),
          rejected: parseInt(matchStats.rows[0].rejected),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching reconciliation stats:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: error.message || 'Failed to fetch reconciliation stats',
      },
    });
  }
});

export default router;
