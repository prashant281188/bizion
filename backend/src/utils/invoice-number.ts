import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '../config/database.js';
import { invoices } from '../db/schema/invoices.js';
import { documentTypeEnum } from '../db/schema/enums.js';

/**
 * Invoice Number Generator
 *
 * Generates sequential invoice numbers per organization and document type.
 * Format: {PREFIX}/{FY}/{SEQUENCE}
 *   - PREFIX: Document type prefix (INV, PI, CN, DN, PRF, QTN, DC, PO, SO)
 *   - FY: Financial year (e.g., 2025-26)
 *   - SEQUENCE: Zero-padded sequential number (e.g., 0001)
 *
 * Example: INV/2025-26/0001
 */

/** Map document types to their prefix codes */
const DOCUMENT_PREFIX_MAP: Record<string, string> = {
  sales_invoice: 'INV',
  purchase_invoice: 'PI',
  credit_note: 'CN',
  debit_note: 'DN',
  proforma: 'PRF',
  quotation: 'QTN',
  delivery_challan: 'DC',
  purchase_order: 'PO',
  sales_order: 'SO',
};

/**
 * Get the Indian financial year string for a given date.
 * Indian FY runs April 1 to March 31.
 * e.g., January 2026 → "2025-26", July 2025 → "2025-26"
 */
export function getFinancialYear(date: Date): string {
  const month = date.getMonth() + 1; // 1-indexed
  const year = date.getFullYear();

  // If month is Jan-Mar, the FY started the previous calendar year
  const fyStartYear = month >= 4 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;

  return `${fyStartYear}-${String(fyEndYear).slice(-2)}`;
}

/**
 * Generate the next sequential invoice number for a given organization and document type.
 *
 * Uses the invoices table to find the highest existing sequence number for the
 * current financial year, then increments by one.
 *
 * @param db - Drizzle database instance
 * @param orgId - Organization UUID
 * @param documentType - Type of document (sales_invoice, credit_note, etc.)
 * @param date - Invoice date (used to determine the financial year)
 * @param padLength - Number of digits for the sequence (default: 4)
 */
export async function generateInvoiceNumber(
  db: Database,
  orgId: string,
  documentType: typeof documentTypeEnum.enumValues[number],
  date: Date = new Date(),
  customPrefix?: string,
  padLength = 4
): Promise<string> {
  const defaultPrefix = DOCUMENT_PREFIX_MAP[documentType];
  if (!defaultPrefix) {
    throw new Error(`Unknown document type: ${documentType}`);
  }

  const fy = getFinancialYear(date);
  const pattern = customPrefix ? `${customPrefix}%` : `${defaultPrefix}/${fy}/%`;

  // Find the highest sequence number for this org/type/FY combination
  const result = await db
    .select({
      maxNumber: sql<string>`MAX(${invoices.invoiceNumber})`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.orgId, orgId),
        eq(invoices.documentType, documentType),
        sql`${invoices.invoiceNumber} LIKE ${pattern}`
      )
    );

  let nextSequence = 1;

  const maxNumber = result[0]?.maxNumber;
  if (maxNumber) {
    let currentSequence = NaN;
    if (customPrefix && maxNumber.startsWith(customPrefix)) {
      // If we used a custom prefix, strip it and parse the remaining digits
      const remaining = maxNumber.substring(customPrefix.length);
      currentSequence = parseInt(remaining, 10);
    } else {
      // Fallback to legacy extraction (after last slash)
      const parts = maxNumber.split('/');
      const lastPart = parts[parts.length - 1];
      currentSequence = parseInt(lastPart, 10);
    }

    if (!isNaN(currentSequence)) {
      nextSequence = currentSequence + 1;
    }
  }

  const sequenceString = String(nextSequence);
  
  if (customPrefix) {
    return `${customPrefix}${sequenceString}`;
  }
  
  return `${defaultPrefix}/${fy}/${sequenceString}`;
}
