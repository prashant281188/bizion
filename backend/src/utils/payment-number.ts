import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '../config/database.js';
import { payments } from '../db/schema/payments.js';
import { getFinancialYear } from './invoice-number.js';

/**
 * Generate the next sequential payment number for a given organization and direction.
 *
 * Format: {PREFIX}/{FY}/{SEQUENCE}
 *   - PREFIX: REC for inbound, PAY for outbound
 *   - FY: Financial year (e.g., 2025-26)
 *   - SEQUENCE: Zero-padded sequential number (e.g., 0001)
 */
export async function generatePaymentNumber(
  db: Database,
  orgId: string,
  direction: 'inbound' | 'outbound',
  date: Date = new Date(),
  customPrefix?: string,
  padLength = 4
): Promise<string> {
  const defaultPrefix = direction === 'inbound' ? 'REC' : 'PAY';
  const fy = getFinancialYear(date);
  const pattern = customPrefix ? `${customPrefix}%` : `${defaultPrefix}/${fy}/%`;

  // Find the highest sequence number for this org/direction/FY combination
  const result = await db
    .select({
      maxNumber: sql<string>`MAX(${payments.paymentNumber})`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.orgId, orgId),
        eq(payments.direction, direction),
        sql`${payments.paymentNumber} LIKE ${pattern}`
      )
    );

  let nextSequence = 1;

  const maxNumber = result[0]?.maxNumber;
  if (maxNumber) {
    let currentSequence = NaN;
    if (customPrefix && maxNumber.startsWith(customPrefix)) {
      const remaining = maxNumber.substring(customPrefix.length);
      currentSequence = parseInt(remaining, 10);
    } else {
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
