import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

/**
 * PDF UPLOAD MIDDLEWARE
 *
 * Purpose: Handle PDF file uploads for remittance advice documents.
 *
 * Security Features:
 * - File type validation (PDF only)
 * - File size limit (20MB per file, suitable for multi-page PDFs)
 * - Filename sanitization
 * - Organized storage in /uploads/remittances/
 * - Multiple file support
 */

// Ensure remittance upload directory exists
const REMITTANCE_UPLOAD_DIR = path.join(__dirname, '../../uploads/remittances');
if (!fs.existsSync(REMITTANCE_UPLOAD_DIR)) {
  fs.mkdirSync(REMITTANCE_UPLOAD_DIR, { recursive: true });
}

/**
 * Multer storage configuration for remittance PDFs
 */
const remittanceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, REMITTANCE_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename with date prefix: YYYYMMDD-timestamp-originalname
    const datePrefix = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const timestamp = Date.now();
    const uniqueSuffix = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);

    // Sanitize filename (remove special characters)
    const sanitizedBasename = basename.replace(/[^a-zA-Z0-9\-_]/g, '_');

    cb(null, `${datePrefix}-${timestamp}-${uniqueSuffix}-${sanitizedBasename}${ext}`);
  },
});

/**
 * File filter to accept only PDF files
 */
const pdfFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    return cb(new Error('Only PDF files are allowed'));
  }

  // Check MIME type
  if (file.mimetype !== 'application/pdf') {
    console.warn(
      `Unexpected MIME type for PDF: ${file.mimetype}, but extension is .pdf, allowing...`
    );
  }

  cb(null, true);
};

/**
 * Multer instance for remittance PDF uploads
 * Supports multiple files (up to 10 PDFs per request)
 */
export const uploadRemittancePDF = multer({
  storage: remittanceStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max per file
    files: 10, // Maximum 10 files per request
  },
  fileFilter: pdfFileFilter,
});

/**
 * Error handling middleware for PDF uploads
 */
export function handlePDFUploadError(error: any, _req: Request, res: any, next: any) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'PDF file too large. Maximum size is 20MB per file.',
        },
      });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOO_MANY_FILES',
          message: 'Too many files. Maximum 10 PDF files per upload.',
        },
      });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNEXPECTED_FILE',
          message: 'Unexpected file field. Use "files" for remittance uploads.',
        },
      });
    }
  }

  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'Only PDF files are allowed for remittance uploads.',
      },
    });
  }

  next(error);
}

/**
 * Clean up uploaded PDF file(s)
 */
export function cleanupPDFFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Cleaned up PDF file: ${filePath}`);
    }
  } catch (error) {
    console.error('Error cleaning up PDF file:', error);
  }
}

/**
 * Clean up uploaded PDF files (multiple)
 */
export function cleanupPDFFiles(filePaths: string[]): void {
  filePaths.forEach((filePath) => cleanupPDFFile(filePath));
}

/**
 * Clean up old remittance files (older than 30 days)
 */
export function cleanupOldRemittanceFiles(): void {
  try {
    const files = fs.readdirSync(REMITTANCE_UPLOAD_DIR);
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    let deletedCount = 0;

    files.forEach((file) => {
      const filePath = path.join(REMITTANCE_UPLOAD_DIR, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile() && stats.mtime.getTime() < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      console.log(`🗑️  Cleaned up ${deletedCount} old remittance file(s)`);
    }
  } catch (error) {
    console.error('Error cleaning up old remittance files:', error);
  }
}
