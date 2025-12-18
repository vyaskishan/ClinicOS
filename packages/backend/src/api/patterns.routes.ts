import { Router, Request, Response } from 'express';
import pool from '../config/database';
import {
  getAllPatterns,
  updatePattern,
  deletePattern,
  getPatternSuggestions,
} from '../services/pattern-learning.service';

/**
 * PATTERN MANAGEMENT API ROUTES
 *
 * Purpose: Manage learned patterns for machine learning system.
 *
 * Endpoints:
 * - GET /api/patterns - List all learned patterns
 * - PUT /api/patterns/:id - Update a pattern
 * - DELETE /api/patterns/:id - Delete a pattern
 * - GET /api/patterns/suggestions - Get pattern suggestions for a payment
 */

const router = Router();

/**
 * GET /api/patterns
 *
 * List all learned patterns with filtering and pagination.
 *
 * Query params:
 * - payee_name: string (filter by payee name, partial match)
 * - min_success_rate: number (filter patterns with success rate >= this)
 * - min_times_used: number (filter patterns used >= this many times)
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 *
 * Response:
 * {
 *   "success": true,
 *   "total": 25,
 *   "limit": 50,
 *   "offset": 0,
 *   "patterns": [
 *     {
 *       "id": "uuid",
 *       "bank_description_pattern": "PHAU | Private Health Australia",
 *       "payee_name": "Private Health Australia",
 *       "patient_name": null,
 *       "match_confidence_boost": 10.00,
 *       "times_used": 15,
 *       "success_rate": 93.33,
 *       "created_from_match_id": "uuid",
 *       "created_at": "2024-01-20T10:00:00Z",
 *       "updated_at": "2024-01-22T15:30:00Z"
 *     }
 *   ]
 * }
 */
router.get('/', async (req: Request, res: Response) => {
  
  const client = await pool.connect();

  try {
    const {
      payee_name,
      min_success_rate,
      min_times_used,
      limit = 50,
      offset = 0,
    } = req.query;

    const filters: any = {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    if (payee_name) {
      filters.payeeName = payee_name as string;
    }

    if (min_success_rate !== undefined) {
      filters.minSuccessRate = parseFloat(min_success_rate as string);
    }

    if (min_times_used !== undefined) {
      filters.minTimesUsed = parseInt(min_times_used as string, 10);
    }

    const result = await getAllPatterns(client, filters);

    return res.json({
      success: true,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
      patterns: result.patterns,
    });
  } catch (error: any) {
    console.error('❌ Failed to list patterns:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to list patterns',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/patterns/:id
 *
 * Update a pattern (admin function).
 *
 * Request Body:
 * {
 *   "bank_description_pattern": "string", // Optional: update pattern string
 *   "match_confidence_boost": number      // Optional: update boost amount (0-100)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "pattern": { ... }
 * }
 */
router.put('/:id', async (req: Request, res: Response) => {
  
  const client = await pool.connect();

  try {
    const patternId = req.params.id;
    const { bank_description_pattern, match_confidence_boost } = req.body;

    if (!bank_description_pattern && match_confidence_boost === undefined) {
      return res.status(400).json({
        success: false,
        error: 'At least one field (bank_description_pattern or match_confidence_boost) is required',
      });
    }

    const updates: any = {};

    if (bank_description_pattern !== undefined) {
      updates.bank_description_pattern = bank_description_pattern;
    }

    if (match_confidence_boost !== undefined) {
      const boost = parseFloat(match_confidence_boost);
      if (boost < 0 || boost > 100) {
        return res.status(400).json({
          success: false,
          error: 'match_confidence_boost must be between 0 and 100',
        });
      }
      updates.match_confidence_boost = boost;
    }

    console.log(`🔧 Updating pattern ${patternId}:`, updates);

    await client.query('BEGIN');

    const pattern = await updatePattern(client, patternId, updates);

    // Create audit log
    await client.query(
      `
      INSERT INTO reconciliation_audit (
        action,
        entity_type,
        entity_id,
        details,
        performed_by
      ) VALUES ('pattern_updated', 'manual_match_pattern', $1, $2, 'admin')
    `,
      [patternId, JSON.stringify({ updates })]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Pattern updated successfully',
      pattern,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to update pattern:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to update pattern',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/patterns/:id
 *
 * Delete a pattern (soft delete - marks as inactive).
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Pattern deleted successfully"
 * }
 */
router.delete('/:id', async (req: Request, res: Response) => {
  
  const client = await pool.connect();

  try {
    const patternId = req.params.id;

    console.log(`🗑️ Deleting pattern ${patternId}`);

    await client.query('BEGIN');

    // Get pattern details for audit log
    const patternResult = await client.query(
      `SELECT * FROM manual_match_patterns WHERE id = $1`,
      [patternId]
    );

    if (patternResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Pattern not found',
      });
    }

    const pattern = patternResult.rows[0];

    await deletePattern(client, patternId);

    // Create audit log
    await client.query(
      `
      INSERT INTO reconciliation_audit (
        action,
        entity_type,
        entity_id,
        details,
        performed_by
      ) VALUES ('pattern_deleted', 'manual_match_pattern', $1, $2, 'admin')
    `,
      [
        patternId,
        JSON.stringify({
          pattern: pattern.bank_description_pattern,
          payee_name: pattern.payee_name,
          times_used: pattern.times_used,
          success_rate: pattern.success_rate,
        }),
      ]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Pattern deleted successfully',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to delete pattern:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to delete pattern',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/patterns/suggestions
 *
 * Get pattern suggestions for a specific payment.
 * Helps users understand why certain matches are suggested.
 *
 * Query params:
 * - payment_id: uuid (required)
 *
 * Response:
 * {
 *   "success": true,
 *   "payment": {
 *     "id": "uuid",
 *     "description": "PHAU Payment 123456 - $320"
 *   },
 *   "suggestions": [
 *     {
 *       "pattern": { ... },
 *       "match_score": 100,
 *       "effective_boost": 10.00,
 *       "explanation": "Pattern 'PHAU | Private Health Australia' matches at 100%. Used 15 times with 93.33% success rate."
 *     }
 *   ]
 * }
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  
  const client = await pool.connect();

  try {
    const { payment_id } = req.query;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        error: 'payment_id is required',
      });
    }

    // Get payment details
    const paymentResult = await client.query(
      `SELECT * FROM payments WHERE id = $1`,
      [payment_id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    const payment = paymentResult.rows[0];

    // Get pattern suggestions
    const suggestions = await getPatternSuggestions(client, payment.description || '');

    return res.json({
      success: true,
      payment: {
        id: payment.id,
        description: payment.description,
        amount: payment.amount,
        date: payment.date,
      },
      suggestions,
    });
  } catch (error: any) {
    console.error('❌ Failed to get pattern suggestions:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to get pattern suggestions',
      message: error.message,
    });
  } finally {
    client.release();
  }
});

export default router;
