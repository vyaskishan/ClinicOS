import pdf from 'pdf-parse';
import fs from 'fs';
import { parseDate } from './csv-parser';

/**
 * PDF TEXT EXTRACTION UTILITY
 *
 * Purpose: Extract text content from PDF files with structure preservation.
 *
 * Features:
 * - Multi-page PDF support
 * - Text structure preservation (line breaks, spacing)
 * - Metadata extraction (page count, info)
 * - Date extraction from content
 * - Error handling for corrupted PDFs
 */

export interface PDFExtractionResult {
  text: string;
  metadata: {
    pageCount: number;
    title?: string;
    author?: string;
    creationDate?: Date;
  };
  extractedDates: Date[];
  success: boolean;
  error?: string;
}

/**
 * Extract text from PDF file
 *
 * @param filePath Path to PDF file
 * @returns Extraction result with text and metadata
 *
 * @example
 * const result = await extractTextFromPDF('/path/to/remittance.pdf');
 * console.log(result.text);
 * console.log(result.metadata.pageCount);
 */
export async function extractTextFromPDF(filePath: string): Promise<PDFExtractionResult> {
  try {
    // Read PDF file
    const dataBuffer = fs.readFileSync(filePath);

    // Parse PDF
    const data = await pdf(dataBuffer);

    // Extract dates from text
    const extractedDates = extractDatesFromText(data.text);

    return {
      text: data.text,
      metadata: {
        pageCount: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
        creationDate: data.info?.CreationDate,
      },
      extractedDates,
      success: true,
    };
  } catch (error: any) {
    console.error('Error extracting text from PDF:', error);

    return {
      text: '',
      metadata: {
        pageCount: 0,
      },
      extractedDates: [],
      success: false,
      error: error.message || 'Failed to extract text from PDF',
    };
  }
}

/**
 * Extract dates from text using multiple date patterns
 *
 * Supports:
 * - DD/MM/YYYY (20/01/2024)
 * - DD-MM-YYYY (20-01-2024)
 * - YYYY-MM-DD (2024-01-20)
 * - DD MMM YYYY (20 Jan 2024)
 * - DD MMMM YYYY (20 January 2024)
 *
 * @param text Text to extract dates from
 * @returns Array of extracted dates
 */
export function extractDatesFromText(text: string): Date[] {
  const dates: Date[] = [];
  const datePatterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
    // YYYY-MM-DD
    /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
    // DD MMM YYYY or DD MMMM YYYY
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
  ];

  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const dateStr = match[0];
      const parsedDate = parseDate(dateStr);

      if (parsedDate) {
        dates.push(parsedDate);
      }
    }
  }

  // Remove duplicates
  const uniqueDates = dates.filter(
    (date, index, self) =>
      index === self.findIndex((d) => d.getTime() === date.getTime())
  );

  return uniqueDates;
}

/**
 * Extract PDF from buffer (for in-memory processing)
 *
 * @param buffer PDF file buffer
 * @returns Extraction result
 */
export async function extractTextFromPDFBuffer(buffer: Buffer): Promise<PDFExtractionResult> {
  try {
    const data = await pdf(buffer);

    const extractedDates = extractDatesFromText(data.text);

    return {
      text: data.text,
      metadata: {
        pageCount: data.numpages,
        title: data.info?.Title,
        author: data.info?.Author,
        creationDate: data.info?.CreationDate,
      },
      extractedDates,
      success: true,
    };
  } catch (error: any) {
    console.error('Error extracting text from PDF buffer:', error);

    return {
      text: '',
      metadata: {
        pageCount: 0,
      },
      extractedDates: [],
      success: false,
      error: error.message || 'Failed to extract text from PDF buffer',
    };
  }
}

/**
 * Validate if file is a valid PDF
 *
 * @param filePath Path to file
 * @returns True if valid PDF
 */
export function isValidPDF(filePath: string): boolean {
  try {
    const buffer = fs.readFileSync(filePath);
    // PDF files start with "%PDF-"
    const header = buffer.toString('utf-8', 0, 5);
    return header === '%PDF-';
  } catch (error) {
    return false;
  }
}

/**
 * Get PDF page count without full text extraction
 *
 * @param filePath Path to PDF file
 * @returns Number of pages
 */
export async function getPDFPageCount(filePath: string): Promise<number> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.numpages;
  } catch (error) {
    console.error('Error getting PDF page count:', error);
    return 0;
  }
}
