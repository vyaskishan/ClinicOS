import { Router, Request, Response } from 'express';
import {
  runDirectMatching,
  DirectMatchOptions,
} from '../services/direct-matching.service';
import { matchRemittancesToPayments } from '../services/remittance-matching.service';
import { getRemittanceById } from '../services/remittance-upload.service';
import { runFuzzyMatching, FuzzyMatchOptions } from '../services/fuzzy-matching.service';

/**
 * RECONCILIATION API ROUTES
 *
 * Purpose: Handle invoice-payment reconciliation endpoints.
 *
 * Endpoints:
 * - POST /api/reconcile/direct - Run Level 1: Direct/Exact Matching
 * - POST /api/reconcile/remittance - Match remittance to payment and create invoice matches
 * - POST /api/reconcile/fuzzy - Run Level 3: Fuzzy Matching (multi-factor scoring)
 * - GET /api/reconcile/stats - Get reconciliation statistics
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
 * POST /api/reconcile/remittance
 *
 * Match a specific remittance to payments and create invoice-payment matches
 *
 * This endpoint handles bulk, partial, and distributed payment scenarios:
 * - Bulk: Single payment → multiple invoices (sum matches)
 * - Partial: Payment amount < invoice outstanding
 * - Distributed: One payment split across multiple invoices with different amounts
 *
 * Request Body:
 * {
 *   "remittance_id": "uuid"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Remittance matched successfully",
 *   "remittance": {
 *     "id": "uuid",
 *     "file_name": "Medicare_Remittance.pdf",
 *     "payer_name": "Medicare Australia",
 *     "payment_code": "MCARE2024012001"
 *   },
 *   "payment_match": {
 *     "payment_id": "uuid",
 *     "match_type": "payment_code_match",
 *     "confidence": 95,
 *     "scenario": "bulk"
 *   },
 *   "invoice_matches": [
 *     {
 *       "invoice_number": "INV-001",
 *       "amount_matched": 450.00,
 *       "status": "fully_paid",
 *       "outstanding": 0.00
 *     }
 *   ]
 * }
 */
router.post('/remittance', async (req: Request, res: Response) => {
  try {
    const { remittance_id } = req.body;

    // Validate input
    if (!remittance_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'remittance_id is required',
        },
      });
    }

    console.log('📥 Remittance reconciliation request received');
    console.log(`   Remittance ID: ${remittance_id}`);

    // Check if remittance exists
    const remittance = await getRemittanceById(remittance_id);
    if (!remittance) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Remittance not found',
        },
      });
    }

    // Run remittance matching for this specific remittance
    const result = await matchRemittancesToPayments({
      remittance_ids: [remittance_id],
    });

    if (result.matched_remittances === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NO_MATCH',
          message: 'No matching payment found for this remittance',
        },
      });
    }

    // Get the match details
    const paymentMatch = result.matches[0];

    // Fetch created invoice matches
    const { query: db } = await import('../config/database');
    const invoiceMatches = await db(
      `SELECT
        m.id as match_id,
        i.invoice_number,
        m.amount_matched,
        i.status,
        i.outstanding_amount,
        m.notes
       FROM matches m
       JOIN invoices i ON i.id = m.invoice_id
       WHERE m.payment_id = $1
       ORDER BY m.created_at DESC`,
      [paymentMatch.payment_id]
    );

    // Parse scenario from notes
    const scenario = invoiceMatches.rows[0]?.notes
      ? JSON.parse(invoiceMatches.rows[0].notes).scenario
      : 'unknown';

    return res.json({
      success: true,
      message: `Remittance matched successfully - ${result.invoice_matches_created} invoice matches created`,
      remittance: {
        id: remittance.id,
        file_name: remittance.file_name,
        payer_name: remittance.parsed_content?.payer_name,
        payment_code: remittance.payment_code,
      },
      payment_match: {
        payment_id: paymentMatch.payment_id,
        match_type: paymentMatch.match_type,
        confidence: paymentMatch.confidence,
        scenario: scenario,
      },
      invoice_matches: invoiceMatches.rows.map((row: any) => ({
        match_id: row.match_id,
        invoice_number: row.invoice_number,
        amount_matched: parseFloat(row.amount_matched),
        status: row.status,
        outstanding: parseFloat(row.outstanding_amount),
      })),
    });
  } catch (error: any) {
    console.error('Error reconciling remittance:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'RECONCILIATION_ERROR',
        message: error.message || 'Failed to reconcile remittance',
      },
    });
  }
});

/**
 * POST /api/reconcile/fuzzy
 *
 * Run Level 3: Fuzzy Matching algorithm
 *
 * Uses multi-factor scoring to match unmatched payments to invoices:
 * - Payer Name Similarity (40% weight) - token_sort_ratio matching
 * - Amount Similarity (30% weight) - dynamic tolerance
 * - Date Proximity (20% weight) - tiered scoring
 * - Payer Alias Check (10% weight) - bonus for alias matches
 *
 * Request Body:
 * {
 *   "min_confidence": 70,           // Minimum score to create match (default: 70)
 *   "auto_confirm_threshold": 85,   // Score for auto-confirmation (default: 85)
 *   "payment_ids": ["uuid1"],       // Optional: specific payments
 *   "invoice_ids": ["uuid2"]        // Optional: specific invoices
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "summary": {
 *     "total_matches": 15,
 *     "pending_review": 8,
 *     "auto_confirmed": 7,
 *     "score_distribution": {
 *       "70-75": 3,
 *       "75-80": 2,
 *       "80-85": 3,
 *       "85-90": 4,
 *       "90-95": 2,
 *       "95-100": 1
 *     }
 *   },
 *   "matches": [
 *     {
 *       "match_id": "uuid",
 *       "payment_id": "uuid",
 *       "invoice_id": "uuid",
 *       "confidence": 87.5,
 *       "status": "confirmed",
 *       "scoring_details": {
 *         "name_similarity": 92,
 *         "amount_difference": 2.50,
 *         "date_difference_days": 5,
 *         "alias_matched": false,
 *         "component_scores": {
 *           "name": 36.8,
 *           "amount": 30,
 *           "date": 15,
 *           "alias": 0
 *         },
 *         "total_score": 87.5
 *       }
 *     }
 *   ]
 * }
 */
router.post('/fuzzy', async (req: Request, res: Response) => {
  try {
    const options: FuzzyMatchOptions = {
      min_confidence: req.body.min_confidence || 70,
      auto_confirm_threshold: req.body.auto_confirm_threshold || 85,
      payment_ids: req.body.payment_ids,
      invoice_ids: req.body.invoice_ids,
    };

    console.log('📥 Fuzzy matching request received');
    console.log(`   Options:`, options);

    // Run fuzzy matching algorithm
    const result = await runFuzzyMatching(options);

    return res.json({
      success: true,
      message: `Fuzzy matching completed: ${result.total_matches} matches found`,
      summary: {
        total_matches: result.total_matches,
        pending_review: result.pending_review,
        auto_confirmed: result.auto_confirmed,
        score_distribution: result.score_distribution,
      },
      matches: result.matches,
    });
  } catch (error: any) {
    console.error('Error running fuzzy matching:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'FUZZY_MATCHING_ERROR',
        message: error.message || 'Failed to run fuzzy matching',
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
