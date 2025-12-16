import { Router, Request, Response } from 'express';
import { upload, cleanupUploadedFile, handleUploadError } from '../middleware/upload';
import { processInvoiceUpload } from '../services/invoice-upload.service';
import { processPaymentUpload } from '../services/payment-upload.service';

/**
 * UPLOAD API ROUTES
 *
 * Purpose: Handle CSV file uploads for invoices and payments.
 *
 * Endpoints:
 * - POST /api/upload/invoices - Upload invoice CSV
 * - POST /api/upload/payments - Upload payment/bank feed CSV
 *
 * Security:
 * - File type validation (CSV only)
 * - File size limit (10MB)
 * - Automatic file cleanup after processing
 */

const router = Router();

/**
 * POST /api/upload/invoices
 *
 * Upload invoice CSV file
 *
 * Request:
 * - multipart/form-data
 * - file field: 'file' (CSV file)
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Invoice upload processed successfully",
 *   "summary": {
 *     "totalRows": 100,
 *     "successCount": 95,
 *     "errorCount": 5,
 *     "paidCount": 30,
 *     "unpaidCount": 50,
 *     "partiallyPaidCount": 15
 *   },
 *   "errors": [
 *     { "row": 3, "error": "Amount must be greater than 0" }
 *   ]
 * }
 */
router.post(
  '/invoices',
  upload.single('file'),
  handleUploadError,
  async (req: Request, res: Response) => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No file uploaded. Please upload a CSV file.',
          },
        });
      }

      console.log(`📤 Invoice upload received: ${req.file.originalname}`);

      // Process invoice upload
      const result = await processInvoiceUpload(req.file.path);

      // Clean up uploaded file
      cleanupUploadedFile(req.file.path);

      // Return result
      return res.json({
        success: true,
        message: 'Invoice upload processed successfully',
        summary: result.summary,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error: any) {
      // Clean up file on error
      if (req.file) {
        cleanupUploadedFile(req.file.path);
      }

      console.error('Error processing invoice upload:', error);

      return res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_PROCESSING_ERROR',
          message: error.message || 'Failed to process invoice upload',
        },
      });
    }
  }
);

/**
 * POST /api/upload/payments
 *
 * Upload payment/bank feed CSV file
 *
 * Request:
 * - multipart/form-data
 * - file field: 'file' (CSV file)
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Payment upload processed successfully",
 *   "summary": {
 *     "totalRows": 50,
 *     "successCount": 48,
 *     "errorCount": 2,
 *     "autoReconciledCount": 10,
 *     "requiresMatchingCount": 38,
 *     "autoReconciledBySource": {
 *       "TYRO": 5,
 *       "MEDICARE_EASYCLAIM": 3,
 *       "DVA": 2
 *     }
 *   },
 *   "errors": []
 * }
 */
router.post(
  '/payments',
  upload.single('file'),
  handleUploadError,
  async (req: Request, res: Response) => {
    try {
      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No file uploaded. Please upload a CSV file.',
          },
        });
      }

      console.log(`📤 Payment upload received: ${req.file.originalname}`);

      // Process payment upload
      const result = await processPaymentUpload(req.file.path);

      // Clean up uploaded file
      cleanupUploadedFile(req.file.path);

      // Return result
      return res.json({
        success: true,
        message: 'Payment upload processed successfully',
        summary: result.summary,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error: any) {
      // Clean up file on error
      if (req.file) {
        cleanupUploadedFile(req.file.path);
      }

      console.error('Error processing payment upload:', error);

      return res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_PROCESSING_ERROR',
          message: error.message || 'Failed to process payment upload',
        },
      });
    }
  }
);

export default router;
