import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

/**
 * FILE UPLOAD MIDDLEWARE
 *
 * Purpose: Handle CSV file uploads with validation and security.
 *
 * Security Features:
 * - File type validation (CSV only)
 * - File size limit (10MB)
 * - Filename sanitization
 * - Temporary storage with cleanup
 */

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);

    // Sanitize filename (remove special characters)
    const sanitizedBasename = basename.replace(/[^a-zA-Z0-9\-_]/g, '_');

    cb(null, `${sanitizedBasename}-${uniqueSuffix}${ext}`);
  },
});

/**
 * File filter to accept only CSV files
 */
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.csv') {
    return cb(new Error('Only CSV files are allowed'));
  }

  // Check MIME type
  if (file.mimetype !== 'text/csv' && file.mimetype !== 'application/csv') {
    // Some systems report different MIME types for CSV, be lenient
    console.warn(`Unexpected MIME type for CSV: ${file.mimetype}, but extension is .csv, allowing...`);
  }

  cb(null, true);
};

/**
 * Multer upload configuration
 */
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1, // Only one file per upload
  },
  fileFilter: fileFilter,
});

/**
 * Clean up uploaded file after processing
 *
 * @param filePath Path to uploaded file
 */
export function cleanupUploadedFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Cleaned up uploaded file: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error('Error cleaning up uploaded file:', error);
  }
}

/**
 * Clean up old uploaded files (older than 24 hours)
 *
 * Should be called periodically (e.g., via cron job)
 */
export function cleanupOldUploads(): void {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    let cleanedCount = 0;

    for (const file of files) {
      const filePath = path.join(UPLOAD_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🗑️  Cleaned up ${cleanedCount} old uploaded files`);
    }
  } catch (error) {
    console.error('Error cleaning up old uploads:', error);
  }
}

/**
 * Middleware to handle upload errors
 */
export function handleUploadError(error: any, _req: Request, res: any, next: any) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds 10MB limit',
        },
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNEXPECTED_FILE',
          message: 'Unexpected file field',
        },
      });
    }

    return res.status(400).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: error.message,
      },
    });
  }

  if (error.message === 'Only CSV files are allowed') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'Only CSV files are allowed. Please upload a .csv file.',
      },
    });
  }

  // Pass other errors to next middleware
  next(error);
}
