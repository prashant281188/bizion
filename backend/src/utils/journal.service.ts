import {
  accounts,
  financialTransactions,
  journalEntries,
} from '../db/schema/accounting.js';
import { eq, and } from 'drizzle-orm';

/**
 * Service to manage double-entry bookkeeping journal entries.
 */
export class JournalService {
  /**
   * Helper to retrieve common system account IDs for an organization by code.
   */
  async getSystemAccountIds(tx: any, orgId: string) {
    const orgAccounts = await tx
      .select({ id: accounts.id, code: accounts.code })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.isSystem, true)));

    const get = (code: string) => {
      const acc = orgAccounts.find((a: any) => a.code === code);
      if (!acc) throw new Error(`System account with code ${code} not found for org ${orgId}`);
      return acc.id;
    };

    return {
      cash: get('1010'),
      bankMain: get('1020'),
      accountsReceivable: get('1030'),
      inventory: get('1040'),
      cgstItc: get('1050'),
      sgstItc: get('1060'),
      igstItc: get('1070'),
      accountsPayable: get('2010'),
      cgstOutput: get('2020'), 
      sgstOutput: get('2030'),
      igstOutput: get('2040'),
      salesGoods: get('4010'),
      cogs: get('5010'),
    };
  }

  /**
   * Write journal entry for a Sales Invoice (or Credit Note)
   */
  async writeInvoiceJournal(
    tx: any,
    orgId: string,
    invoice: any,
    userId: string | null
  ) {
    // Delete any existing entries for this invoice (useful on update)
    await this.deleteJournalBySource(tx, orgId, 'invoice', invoice.id);

    // Draft and cancelled invoices do not have accounting impact
    if (invoice.status === 'draft' || invoice.status === 'cancelled') {
      return;
    }

    const sysAcc = await this.getSystemAccountIds(tx, orgId);

    const transactionNumber = `JNL-INV-${invoice.invoiceNumber}`;
    
    // Create transaction header
    const [txn] = await tx
      .insert(financialTransactions)
      .values({
        orgId,
        transactionNumber,
        transactionDate: invoice.invoiceDate,
        description: `Journal entry for ${invoice.documentType} ${invoice.invoiceNumber}`,
        sourceType: 'invoice',
        sourceId: invoice.id,
        status: 'posted',
        createdBy: userId,
        postedAt: new Date(),
      })
      .returning();

    const entries: any[] = [];
    const totalAmount = Number(invoice.totalAmount);
    const taxableAmount = Number(invoice.taxableAmount);
    const cgstAmount = Number(invoice.cgstAmount);
    const sgstAmount = Number(invoice.sgstAmount);
    const igstAmount = Number(invoice.igstAmount);

    if (invoice.documentType === 'sales_invoice') {
      // DR Accounts Receivable
      entries.push({
        orgId,
        transactionId: txn.id,
        accountId: sysAcc.accountsReceivable,
        entryType: 'debit',
        amount: String(totalAmount),
        contactId: invoice.contactId,
      });

      // CR Sales Revenue
      if (taxableAmount > 0) {
        entries.push({
          orgId,
          transactionId: txn.id,
          accountId: sysAcc.salesGoods,
          entryType: 'credit',
          amount: String(taxableAmount),
        });
      }

      // CR GST Output
      if (cgstAmount > 0) {
        entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.cgstOutput, entryType: 'credit', amount: String(cgstAmount) });
      }
      if (sgstAmount > 0) {
        entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.sgstOutput, entryType: 'credit', amount: String(sgstAmount) });
      }
      if (igstAmount > 0) {
        entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.igstOutput, entryType: 'credit', amount: String(igstAmount) });
      }
    } else if (invoice.documentType === 'purchase_invoice') {
      // DR Inventory (Purchases)
      if (taxableAmount > 0) {
        entries.push({
          orgId,
          transactionId: txn.id,
          accountId: sysAcc.inventory,
          entryType: 'debit',
          amount: String(taxableAmount),
        });
      }

      // DR GST ITC
      if (cgstAmount > 0) {
        entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.cgstItc, entryType: 'debit', amount: String(cgstAmount) });
      }
      if (sgstAmount > 0) {
        entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.sgstItc, entryType: 'debit', amount: String(sgstAmount) });
      }
      if (igstAmount > 0) {
        entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.igstItc, entryType: 'debit', amount: String(igstAmount) });
      }

      // CR Accounts Payable
      entries.push({
        orgId,
        transactionId: txn.id,
        accountId: sysAcc.accountsPayable,
        entryType: 'credit',
        amount: String(totalAmount),
        contactId: invoice.contactId,
      });
    } else if (invoice.documentType === 'credit_note') {
      // Sales Return
      if (taxableAmount > 0) {
        entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.salesGoods, entryType: 'debit', amount: String(taxableAmount) }); // Ideally Sales Returns account, mapping to Sales for now
      }
      if (cgstAmount > 0) entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.cgstOutput, entryType: 'debit', amount: String(cgstAmount) });
      if (sgstAmount > 0) entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.sgstOutput, entryType: 'debit', amount: String(sgstAmount) });
      if (igstAmount > 0) entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.igstOutput, entryType: 'debit', amount: String(igstAmount) });
      
      entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.accountsReceivable, entryType: 'credit', amount: String(totalAmount), contactId: invoice.contactId });
    } else if (invoice.documentType === 'debit_note') {
      // Purchase Return
      entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.accountsPayable, entryType: 'debit', amount: String(totalAmount), contactId: invoice.contactId });
      
      if (taxableAmount > 0) entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.inventory, entryType: 'credit', amount: String(taxableAmount) });
      if (cgstAmount > 0) entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.cgstItc, entryType: 'credit', amount: String(cgstAmount) });
      if (sgstAmount > 0) entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.sgstItc, entryType: 'credit', amount: String(sgstAmount) });
      if (igstAmount > 0) entries.push({ orgId, transactionId: txn.id, accountId: sysAcc.igstItc, entryType: 'credit', amount: String(igstAmount) });
    }

    if (entries.length > 0) {
      await tx.insert(journalEntries).values(entries);
    }
  }

  /**
   * Write journal entry for a Payment
   */
  async writePaymentJournal(
    tx: any,
    orgId: string,
    payment: any,
    userId: string | null,
    isReversal = false
  ) {
    const sysAcc = await this.getSystemAccountIds(tx, orgId);

    const transactionNumber = `JNL-PAY-${payment.paymentNumber}${isReversal ? '-REV' : ''}`;
    
    const [txn] = await tx
      .insert(financialTransactions)
      .values({
        orgId,
        transactionNumber,
        transactionDate: isReversal ? new Date().toISOString().split('T')[0] : payment.paymentDate,
        description: `${isReversal ? 'Reversal of ' : ''}Payment ${payment.paymentNumber}`,
        sourceType: 'payment',
        sourceId: payment.id,
        status: 'posted',
        createdBy: userId,
        postedAt: new Date(),
      })
      .returning();

    const entries: any[] = [];
    const amount = Number(payment.amount);

    // Assume all bank payments go to BankMain, cash to Cash
    const cashBankAccountId = payment.paymentMode === 'cash' ? sysAcc.cash : sysAcc.bankMain;

    if (payment.direction === 'inbound') {
      entries.push({
        orgId,
        transactionId: txn.id,
        accountId: cashBankAccountId,
        entryType: isReversal ? 'credit' : 'debit',
        amount: String(amount),
      });
      entries.push({
        orgId,
        transactionId: txn.id,
        accountId: sysAcc.accountsReceivable,
        entryType: isReversal ? 'debit' : 'credit',
        amount: String(amount),
        contactId: payment.contactId,
      });
    } else {
      // outbound
      entries.push({
        orgId,
        transactionId: txn.id,
        accountId: sysAcc.accountsPayable,
        entryType: isReversal ? 'credit' : 'debit',
        amount: String(amount),
        contactId: payment.contactId,
      });
      entries.push({
        orgId,
        transactionId: txn.id,
        accountId: cashBankAccountId,
        entryType: isReversal ? 'debit' : 'credit',
        amount: String(amount),
      });
    }

    if (entries.length > 0) {
      await tx.insert(journalEntries).values(entries);
    }
  }

  /**
   * Remove journal entries by source
   */
  async deleteJournalBySource(tx: any, orgId: string, sourceType: string, sourceId: string) {
    await tx.delete(financialTransactions).where(
      and(
        eq(financialTransactions.orgId, orgId),
        eq(financialTransactions.sourceType, sourceType),
        eq(financialTransactions.sourceId, sourceId)
      )
    );
  }

  /**
   * Write journal entry for Credit Note / Debit Note application (allocation)
   */
  async writeAllocationJournal(
    tx: any,
    orgId: string,
    allocationId: string,
    noteId: string,
    invoiceId: string,
    amount: number,
    type: 'credit_note' | 'debit_note',
    userId: string | null,
    isReversal = false
  ) {
    const sysAcc = await this.getSystemAccountIds(tx, orgId);

    const transactionNumber = `JNL-ALLOC-${allocationId.slice(0, 8)}${isReversal ? '-REV' : ''}`;
    
    const [txn] = await tx
      .insert(financialTransactions)
      .values({
        orgId,
        transactionNumber,
        transactionDate: new Date().toISOString().split('T')[0],
        description: `${isReversal ? 'Reversal of ' : ''}${type} allocation to invoice`,
        sourceType: 'allocation',
        sourceId: allocationId,
        status: 'posted',
        createdBy: userId,
        postedAt: new Date(),
      })
      .returning();

    const entries: any[] = [];
    const strAmount = String(amount);

    if (type === 'credit_note') {
      // For sales: credit note (AR reducing) applied to sales invoice (AR reducing)
      // Wait, in double entry, applying a credit note against an invoice is a wash in the AR ledger,
      // it's just matching. Often no journal entry is needed in the general ledger because AR doesn't change
      // its net balance. But for clarity, we can do a dummy entry or skip it.
      // Let's skip GL entry for allocation to avoid inflating AR turnover, because 
      // the invoice already Debited AR, the credit note already Credited AR.
      // The allocation just links them. We don't need a journal entry for allocation!
    } else if (type === 'debit_note') {
      // Same here. Purchase Invoice Credited AP, Debit Note Debited AP.
      // Allocation just links them.
    }

    if (entries.length > 0) {
      await tx.insert(journalEntries).values(entries);
    }
  }
}

export const journalService = new JournalService();
