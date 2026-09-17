import { db } from '../../config/database.js';
import { invoices } from '../../db/schema/invoices.js';
import { creditNoteAllocations } from '../../db/schema/payments.js';
import { contacts } from '../../db/schema/contacts.js';
import { ApiError } from '../../utils/api-error.js';
import { eq, and, sql, inArray, notInArray } from 'drizzle-orm';

interface ApplyCreditNoteInput {
  creditNoteId: string;
  invoiceId: string;
  amountApplied: number;
  appliedDate: string;
  notes?: string;
}

export class CreditNoteService {
  /**
   * Get all credit notes with remaining balance for a customer.
   * These are available to be applied against open invoices.
   */
  async getAvailableCredits(orgId: string, contactId: string) {
    const creditNotes = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        totalAmount: invoices.totalAmount,
        amountPaid: invoices.amountPaid,
        balanceDue: invoices.balanceDue,
        status: invoices.status,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.orgId, orgId),
          eq(invoices.contactId, contactId),
          eq(invoices.documentType, 'credit_note'),
          notInArray(invoices.status, ['draft', 'void', 'cancelled', 'paid'])
        )
      );

    // Return only those with remaining balance
    return creditNotes.filter((cn) => Number(cn.balanceDue) > 0);
  }

  /**
   * Get all debit notes with remaining balance for a supplier (contact).
   */
  async getAvailableDebits(orgId: string, contactId: string) {
    const debitNotes = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        totalAmount: invoices.totalAmount,
        amountPaid: invoices.amountPaid,
        balanceDue: invoices.balanceDue,
        status: invoices.status,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.orgId, orgId),
          eq(invoices.contactId, contactId),
          eq(invoices.documentType, 'debit_note'),
          notInArray(invoices.status, ['draft', 'void', 'cancelled', 'paid'])
        )
      );

    return debitNotes.filter((dn) => Number(dn.balanceDue) > 0);
  }

  /**
   * Apply a credit note (partially or fully) to an open invoice.
   * Both the credit note balance and the invoice balance are reduced.
   */
  async applyCreditNote(orgId: string, userId: string, input: ApplyCreditNoteInput) {
    const amountApplied = Number(Number(input.amountApplied).toFixed(2));

    if (amountApplied <= 0) {
      throw new ApiError(400, 'Amount to apply must be greater than zero');
    }

    return await db.transaction(async (tx) => {
      // 1. Fetch the credit note
      const [creditNote] = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.creditNoteId),
            eq(invoices.orgId, orgId),
            eq(invoices.documentType, 'credit_note')
          )
        );

      if (!creditNote) {
        throw new ApiError(404, 'Credit note not found');
      }
      if (creditNote.status === 'paid' || creditNote.status === 'void' || creditNote.status === 'cancelled') {
        throw new ApiError(400, `Credit note ${creditNote.invoiceNumber} is ${creditNote.status} and cannot be applied`);
      }

      const cnBalance = Number(Number(creditNote.balanceDue).toFixed(2));
      if (amountApplied > cnBalance) {
        throw new ApiError(
          400,
          `Cannot apply ₹${amountApplied.toFixed(2)}. Credit note ${creditNote.invoiceNumber} only has ₹${cnBalance.toFixed(2)} remaining.`
        );
      }

      // 2. Fetch the target invoice
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.orgId, orgId),
            inArray(invoices.documentType, ['sales_invoice', 'debit_note'])
          )
        );

      if (!invoice) {
        throw new ApiError(404, 'Invoice not found or is not a sales invoice / debit note');
      }
      if (invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'cancelled') {
        throw new ApiError(400, `Invoice ${invoice.invoiceNumber} is ${invoice.status} and cannot receive credit`);
      }

      // Validate same contact
      if (creditNote.contactId !== invoice.contactId) {
        throw new ApiError(400, 'Credit note and invoice must belong to the same customer');
      }

      const invoiceBalance = Number(Number(invoice.balanceDue).toFixed(2));
      if (amountApplied > invoiceBalance) {
        throw new ApiError(
          400,
          `Cannot apply ₹${amountApplied.toFixed(2)} to invoice ${invoice.invoiceNumber}. Remaining balance is ₹${invoiceBalance.toFixed(2)}.`
        );
      }

      // 3. Insert allocation record
      const [allocation] = await tx
        .insert(creditNoteAllocations)
        .values({
          orgId,
          creditNoteId: input.creditNoteId,
          invoiceId: input.invoiceId,
          amountApplied: amountApplied.toFixed(2),
          appliedDate: input.appliedDate,
          notes: input.notes || `Credit note ${creditNote.invoiceNumber} applied to ${invoice.invoiceNumber}`,
          createdBy: userId,
        })
        .returning();

      // 4. Update credit note: reduce its available balance
      const cnNewPaid = Number((Number(creditNote.amountPaid) + amountApplied).toFixed(2));
      const cnNewDue = Number((Number(creditNote.totalAmount) - cnNewPaid).toFixed(2));
      await tx
        .update(invoices)
        .set({
          amountPaid: cnNewPaid.toFixed(2),
          balanceDue: cnNewDue.toFixed(2),
          status: cnNewDue === 0 ? 'paid' : 'partially_paid',
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.creditNoteId));

      // 5. Update invoice: reduce its balance due
      const invNewPaid = Number((Number(invoice.amountPaid) + amountApplied).toFixed(2));
      const invNewDue = Number((Number(invoice.totalAmount) - invNewPaid).toFixed(2));
      let invStatus: string = invoice.status;
      if (invNewDue === 0) {
        invStatus = 'paid';
      } else if (invNewPaid > 0) {
        invStatus = 'partially_paid';
      }
      await tx
        .update(invoices)
        .set({
          amountPaid: invNewPaid.toFixed(2),
          balanceDue: Math.max(0, invNewDue).toFixed(2),
          status: invStatus as any,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.invoiceId));

      return allocation;
    });
  }

  /**
   * Apply a debit note (partially or fully) to an open purchase invoice.
   */
  async applyDebitNote(orgId: string, userId: string, input: { debitNoteId: string; invoiceId: string; amountApplied: number; appliedDate: string; notes?: string }) {
    const amountApplied = Number(Number(input.amountApplied).toFixed(2));

    if (amountApplied <= 0) {
      throw new ApiError(400, 'Amount to apply must be greater than zero');
    }

    return await db.transaction(async (tx) => {
      // 1. Fetch the debit note
      const [debitNote] = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.debitNoteId),
            eq(invoices.orgId, orgId),
            eq(invoices.documentType, 'debit_note')
          )
        );

      if (!debitNote) {
        throw new ApiError(404, 'Debit note not found');
      }
      if (debitNote.status === 'paid' || debitNote.status === 'void' || debitNote.status === 'cancelled') {
        throw new ApiError(400, `Debit note ${debitNote.invoiceNumber} is ${debitNote.status} and cannot be applied`);
      }

      const dnBalance = Number(Number(debitNote.balanceDue).toFixed(2));
      if (amountApplied > dnBalance) {
        throw new ApiError(
          400,
          `Cannot apply ₹${amountApplied.toFixed(2)}. Debit note ${debitNote.invoiceNumber} only has ₹${dnBalance.toFixed(2)} remaining.`
        );
      }

      // 2. Fetch the target purchase invoice
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.orgId, orgId),
            eq(invoices.documentType, 'purchase_invoice')
          )
        );

      if (!invoice) {
        throw new ApiError(404, 'Invoice not found or is not a purchase invoice');
      }
      if (invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'cancelled') {
        throw new ApiError(400, `Invoice ${invoice.invoiceNumber} is ${invoice.status} and cannot receive debit note allocation`);
      }

      // Validate same contact
      if (debitNote.contactId !== invoice.contactId) {
        throw new ApiError(400, 'Debit note and invoice must belong to the same supplier');
      }

      const invoiceBalance = Number(Number(invoice.balanceDue).toFixed(2));
      if (amountApplied > invoiceBalance) {
        throw new ApiError(
          400,
          `Cannot apply ₹${amountApplied.toFixed(2)} to invoice ${invoice.invoiceNumber}. Remaining balance is ₹${invoiceBalance.toFixed(2)}.`
        );
      }

      // 3. Insert allocation record (we use creditNoteAllocations table for both, as they functionally act the same)
      const [allocation] = await tx
        .insert(creditNoteAllocations)
        .values({
          orgId,
          creditNoteId: input.debitNoteId, // reusing this field
          invoiceId: input.invoiceId,
          amountApplied: amountApplied.toFixed(2),
          appliedDate: input.appliedDate,
          notes: input.notes || `Debit note ${debitNote.invoiceNumber} applied to ${invoice.invoiceNumber}`,
          createdBy: userId,
        })
        .returning();

      // 4. Update debit note: reduce its available balance
      const dnNewPaid = Number((Number(debitNote.amountPaid) + amountApplied).toFixed(2));
      const dnNewDue = Number((Number(debitNote.totalAmount) - dnNewPaid).toFixed(2));
      await tx
        .update(invoices)
        .set({
          amountPaid: dnNewPaid.toFixed(2),
          balanceDue: dnNewDue.toFixed(2),
          status: dnNewDue === 0 ? 'paid' : 'partially_paid',
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.debitNoteId));

      // 5. Update invoice: reduce its balance due
      const invNewPaid = Number((Number(invoice.amountPaid) + amountApplied).toFixed(2));
      const invNewDue = Number((Number(invoice.totalAmount) - invNewPaid).toFixed(2));
      let invStatus: string = invoice.status;
      if (invNewDue === 0) {
        invStatus = 'paid';
      } else if (invNewPaid > 0) {
        invStatus = 'partially_paid';
      }
      await tx
        .update(invoices)
        .set({
          amountPaid: invNewPaid.toFixed(2),
          balanceDue: Math.max(0, invNewDue).toFixed(2),
          status: invStatus as any,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, input.invoiceId));

      return allocation;
    });
  }

  /**
   * List all allocations for a specific credit note.
   */
  async listAllocations(orgId: string, creditNoteId: string) {
    const rows = await db
      .select({
        id: creditNoteAllocations.id,
        amountApplied: creditNoteAllocations.amountApplied,
        appliedDate: creditNoteAllocations.appliedDate,
        notes: creditNoteAllocations.notes,
        invoiceId: creditNoteAllocations.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        invoiceTotal: invoices.totalAmount,
      })
      .from(creditNoteAllocations)
      .innerJoin(invoices, eq(creditNoteAllocations.invoiceId, invoices.id))
      .where(
        and(
          eq(creditNoteAllocations.orgId, orgId),
          eq(creditNoteAllocations.creditNoteId, creditNoteId)
        )
      );
    return rows;
  }

  /**
   * List all credit note allocations that have been applied to a specific invoice.
   */
  async listAllocationsForInvoice(orgId: string, invoiceId: string) {
    const rows = await db
      .select({
        id: creditNoteAllocations.id,
        amountApplied: creditNoteAllocations.amountApplied,
        appliedDate: creditNoteAllocations.appliedDate,
        notes: creditNoteAllocations.notes,
        creditNoteId: creditNoteAllocations.creditNoteId,
        creditNoteNumber: invoices.invoiceNumber,
        creditNoteTotal: invoices.totalAmount,
      })
      .from(creditNoteAllocations)
      .innerJoin(invoices, eq(creditNoteAllocations.creditNoteId, invoices.id))
      .where(
        and(
          eq(creditNoteAllocations.orgId, orgId),
          eq(creditNoteAllocations.invoiceId, invoiceId)
        )
      );
    return rows;
  }

  /**
   * Remove (void) a credit note allocation. Reverses the balance changes.
   */
  async removeAllocation(orgId: string, allocationId: string) {
    return await db.transaction(async (tx) => {
      // 1. Get the allocation
      const [alloc] = await tx
        .select()
        .from(creditNoteAllocations)
        .where(
          and(
            eq(creditNoteAllocations.id, allocationId),
            eq(creditNoteAllocations.orgId, orgId)
          )
        );

      if (!alloc) {
        throw new ApiError(404, 'Credit note allocation not found');
      }

      const amountApplied = Number(alloc.amountApplied);

      // 2. Revert credit note balance
      const [creditNote] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, alloc.creditNoteId));

      if (creditNote) {
        const cnNewPaid = Math.max(0, Number((Number(creditNote.amountPaid) - amountApplied).toFixed(2)));
        const cnNewDue = Number((Number(creditNote.totalAmount) - cnNewPaid).toFixed(2));
        await tx
          .update(invoices)
          .set({
            amountPaid: cnNewPaid.toFixed(2),
            balanceDue: cnNewDue.toFixed(2),
            status: cnNewPaid === 0 ? 'approved' : 'partially_paid',
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, alloc.creditNoteId));
      }

      // 3. Revert invoice balance
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, alloc.invoiceId));

      if (invoice) {
        const invNewPaid = Math.max(0, Number((Number(invoice.amountPaid) - amountApplied).toFixed(2)));
        const invNewDue = Number((Number(invoice.totalAmount) - invNewPaid).toFixed(2));
        await tx
          .update(invoices)
          .set({
            amountPaid: invNewPaid.toFixed(2),
            balanceDue: invNewDue.toFixed(2),
            status: invNewPaid === 0 ? 'approved' : 'partially_paid',
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, alloc.invoiceId));
      }

      // 4. Delete the allocation record
      await tx
        .delete(creditNoteAllocations)
        .where(eq(creditNoteAllocations.id, allocationId));

      return { success: true, message: 'Credit note allocation removed successfully' };
    });
  }
}

export const creditNoteService = new CreditNoteService();
