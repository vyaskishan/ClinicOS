import { Router, Request, Response } from 'express';
import {
  uploadRemittancePDF,
  handlePDFUploadError,
  cleanupPDFFiles,
} from '../middleware/upload-pdf';
import {
  processRemittanceUploads,
  getRemittanceById,
  getRemittances,
} from '../services/remittance-upload.service';
import { matchRemittancesToPayments } from '../services/remittance-matching.service';

/**
 * REMITTANCE API ROUTES
 *
 * Purpose: Handle remittance advice PDF uploads and matching.
 *
 * Endpoints:
 * - POST /api/remittances/upload - Upload remittance PDF(s)
 * - POST /api/remittances/match - Match remittances to payments
 * - GET /api/remittances - List all remittances
 * - GET /api/remittances/:id - Get single remittance
 */

const router = Router();

/**
 * POST /api/remittances/upload
 *
 * Upload one or more remittance PDF files
 *
 * Request:
 * - multipart/form-data
 * - field: 'files' (multiple PDF files)
 *
 * Response:
 * {
 *   "success": true,
 *   "summary": {
 *     "totalFiles": 3,
 *     "successCount": 3,
 *     "errorCount": 0,
 *     "totalRemittances": 3,
 *     "totalAmount": 4050.00,
 *     "withPaymentCode": 2,
 *     "withoutPaymentCode": 1
 *   },
 *   "remittances": [
 *     {
 *       "file_name": "medicare_remittance_20240120.pdf",
 *       "remittance_id": "uuid",
 *       "payer_name": "Medicare Australia",
 *       "payment_code": "MCARE2024012001",
 *       "total_amount": 1350.00,
 *       "line_items_count": 3,
 *       "parsing_confidence": 100
 *     }
 *   ],
 *   "errors": []
 * }
 */
router.post(
  '/upload',
  uploadRemittancePDF.array('files', 10),
  handlePDFUploadError,
  async (req: Request, res: Response) => {
    try {
      // Check if files were uploaded
      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILES',
            message: 'No files uploaded. Please upload one or more PDF files.',
          },
        });
      }

      const files = req.files as Express.Multer.File[];
      console.log(`📥 Remittance upload received: ${files.length} file(s)`);

      // Process remittance uploads
      const result = await processRemittanceUploads(
        files.map((f) => ({ path: f.path, originalname: f.originalname }))
      );

      // Note: Files are NOT cleaned up - they're stored for record keeping
      // Use cleanup scripts for old files if needed

      return res.json({
        success: result.success,
        message: `Processed ${result.summary.successCount} of ${result.summary.totalFiles} file(s)`,
        summary: result.summary,
        remittances: result.remittances,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error: any) {
      // Clean up files on error
      if (req.files) {
        const files = req.files as Express.Multer.File[];
        cleanupPDFFiles(files.map((f) => f.path));
      }

      console.error('Error processing remittance upload:', error);

      return res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_PROCESSING_ERROR',
          message: error.message || 'Failed to process remittance upload',
        },
      });
    }
  }
);

/**
 * POST /api/remittances/match
 *
 * Match remittances to bank payments
 *
 * Request Body:
 * {
 *   "remittance_ids": ["uuid1", "uuid2"],  // Optional: specific remittances
 *   "payment_ids": ["uuid3", "uuid4"]      // Optional: specific payments
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "summary": {
 *     "total_remittances": 3,
 *     "matched_remittances": 3,
 *     "unmatched_remittances": 0,
 *     "by_match_type": {
 *       "payment_code_match": 2,
 *       "date_amount_payer": 1
 *     },
 *     "invoice_matches_created": 9
 *   },
 *   "matches": [
 *     {
 *       "remittance_id": "uuid",
 *       "payment_id": "uuid",
 *       "match_type": "payment_code_match",
 *       "confidence": 95,
 *       "matched_by": ["payment_code", "amount"],
 *       "details": {
 *         "payment_code_match": true,
 *         "amount_difference": 0
 *       }
 *     }
 *   ]
 * }
 */
router.post('/match', async (req: Request, res: Response) => {
  try {
    const { remittance_ids, payment_ids } = req.body;

    console.log('📥 Remittance matching request received');

    // Run remittance-payment matching
    const result = await matchRemittancesToPayments({
      remittance_ids,
      payment_ids,
    });

    return res.json({
      success: true,
      message: `Matched ${result.matched_remittances} remittance(s), created ${result.invoice_matches_created} invoice matches`,
      summary: result,
      matches: result.matches,
    });
  } catch (error: any) {
    console.error('Error matching remittances:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'MATCHING_ERROR',
        message: error.message || 'Failed to match remittances',
      },
    });
  }
});

/**
 * GET /api/remittances
 *
 * Get all remittances with optional filters
 *
 * Query Parameters:
 * - payer_name: Filter by payer name (partial match)
 * - payment_code: Filter by payment code (exact match)
 * - date_from: Filter by remittance date (YYYY-MM-DD)
 * - date_to: Filter by remittance date (YYYY-MM-DD)
 * - min_confidence: Minimum parsing confidence (0-100)
 *
 * Response:
 * {
 *   "success": true,
 *   "count": 10,
 *   "remittances": [
 *     {
 *       "id": "uuid",
 *       "file_name": "medicare_remittance.pdf",
 *       "payer_name": "Medicare Australia",
 *       "payment_code": "MCARE2024012001",
 *       "remittance_date": "2024-01-20",
 *       "total_amount": 1350.00,
 *       "parsing_confidence": 100,
 *       "created_at": "2024-01-21T10:00:00Z"
 *     }
 *   ]
 * }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = {
      payer_name: req.query.payer_name as string,
      payment_code: req.query.payment_code as string,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
      min_confidence: req.query.min_confidence
        ? parseInt(req.query.min_confidence as string)
        : undefined,
    };

    const remittances = await getRemittances(filters);

    return res.json({
      success: true,
      count: remittances.length,
      remittances,
    });
  } catch (error: any) {
    console.error('Error fetching remittances:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error.message || 'Failed to fetch remittances',
      },
    });
  }
});

/**
 * GET /api/remittances/:id
 *
 * Get single remittance with full details
 *
 * Response:
 * {
 *   "success": true,
 *   "remittance": {
 *     "id": "uuid",
 *     "file_name": "medicare_remittance.pdf",
 *     "file_path": "/uploads/remittances/20240120-...",
 *     "payer_name": "Medicare Australia",
 *     "payment_code": "MCARE2024012001",
 *     "remittance_date": "2024-01-20",
 *     "total_amount": 1350.00,
 *     "parsed_content": {
 *       "line_items": [...]
 *     },
 *     "raw_text": "...",
 *     "page_count": 2,
 *     "parsing_confidence": 100
 *   }
 * }
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const remittance = await getRemittanceById(req.params.id);

    return res.json({
      success: true,
      remittance,
    });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
    }

    console.error('Error fetching remittance:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error.message || 'Failed to fetch remittance',
      },
    });
  }
});

export default router;
