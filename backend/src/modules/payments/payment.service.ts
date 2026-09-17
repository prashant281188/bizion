import { db } from '../../config/database.js';
import { payments } from '../../db/schema/payments.js';
import { paymentAllocations } from '../../db/schema/payments.js';
import { bankAccounts } from '../../db/schema/payments.js';
import { invoices } from '../../db/schema/invoices.js';
import { journalService } from '../../utils/journal.service.js';
import { contacts } from '../../db/schema/contacts.js';
import { ApiError } from '../../utils/api-error.js';
import { generatePaymentNumber } from '../../utils/payment-number.js';
import { eq, and, desc, asc, sql, or } from 'drizzle-orm';
import { buildPaginationMeta, getOffset } from '../../utils/pagination.js';
import type { CreatePaymentInput, CreateBankAccountInput, UpdateBankAccountInput, UpdatePaymentStatusInput } from './payment.schema.js';

export class PaymentService {
  // ─── Bank Accounts CRUD ────────────────────────────────────────────────────

  async listBankAccounts(orgId: string) {
    let accounts = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), sql`${bankAccounts.deletedAt} IS NULL`))
      .orderBy(desc(bankAccounts.isDefault), desc(bankAccounts.createdAt));

    // Auto-seed default bank accounts if none exist for a smooth onboarding experience
    if (accounts.length === 0) {
      await db.transaction(async (tx) => {
        await tx.insert(bankAccounts).values([
          {
            orgId,
            accountName: 'Cash Account',
            bankName: 'Cash on Hand',
            openingBalance: '0.00',
            currentBalance: '0.00',
            isDefault: true,
            isActive: true,
          },
          {
            orgId,
            accountName: 'Main Bank Account',
            bankName: 'Generic Bank',
            openingBalance: '0.00',
            currentBalance: '0.00',
            isDefault: false,
            isActive: true,
          }
        ]);
      });

      accounts = await db
        .select()
        .from(bankAccounts)
        .where(and(eq(bankAccounts.orgId, orgId), sql`${bankAccounts.deletedAt} IS NULL`))
        .orderBy(desc(bankAccounts.isDefault), desc(bankAccounts.createdAt));
    }

    return accounts;
  }

  async getBankAccount(orgId: string, id: string) {
    const [account] = await db
      .select()
      .from(bankAccounts)
      .where(
        and(
          eq(bankAccounts.id, id),
          eq(bankAccounts.orgId, orgId),
          sql`${bankAccounts.deletedAt} IS NULL`
        )
      );

    if (!account) {
      throw new ApiError(404, 'Bank account not found');
    }

    return account;
  }

  async getBankAccountLedger(orgId: string, id: string) {
    const account = await this.getBankAccount(orgId, id);

    const accountPayments = await db
      .select({
        id: payments.id,
        date: payments.paymentDate,
        transactionNumber: payments.paymentNumber,
        amount: payments.amount,
        direction: payments.direction,
        status: payments.status,
      })
      .from(payments)
      .where(
        and(
          eq(payments.orgId, orgId),
          eq(payments.bankAccountId, id)
        )
      )
      .orderBy(asc(payments.paymentDate), asc(payments.createdAt));

    const ledger: any[] = [];
    let runningBalance = Number(account.openingBalance || 0);

    accountPayments.forEach(pay => {
      if (pay.status === 'cancelled' || pay.status === 'failed') {
        return;
      }

      let entryType = 'credit';
      const amount = Number(pay.amount);
      if (pay.direction === 'inbound') {
        entryType = 'debit';
        runningBalance += amount;
      } else if (pay.direction === 'outbound') {
        entryType = 'credit';
        runningBalance -= amount;
      }

      ledger.push({
        id: pay.id,
        date: pay.date,
        description: pay.direction === 'inbound' ? 'Money Received' : 'Money Sent',
        transactionNumber: pay.transactionNumber,
        entryType,
        amount: pay.amount,
        status: pay.status,
        runningBalance
      });
    });

    return {
      account,
      ledger
    };
  }

  async createBankAccount(orgId: string, input: CreateBankAccountInput) {
    return await db.transaction(async (tx) => {
      // If setting this one as default, unset other defaults
      if (input.isDefault) {
        await tx
          .update(bankAccounts)
          .set({ isDefault: false })
          .where(eq(bankAccounts.orgId, orgId));
      }

      const [newAccount] = await tx
        .insert(bankAccounts)
        .values({
          orgId,
          accountName: input.accountName,
          bankName: input.bankName || null,
          accountNumber: input.accountNumber || null,
          ifscCode: input.ifscCode || null,
          branch: input.branch || null,
          accountType: input.accountType || null,
          upiId: input.upiId || null,
          openingBalance: String(input.openingBalance || 0),
          currentBalance: String(input.openingBalance || 0),
          isDefault: !!input.isDefault,
          isActive: input.isActive !== false,
        })
        .returning();

      return newAccount;
    });
  }

  async updateBankAccount(orgId: string, id: string, input: UpdateBankAccountInput) {
    const account = await this.getBankAccount(orgId, id);

    return await db.transaction(async (tx) => {
      if (input.isDefault) {
        await tx
          .update(bankAccounts)
          .set({ isDefault: false })
          .where(eq(bankAccounts.orgId, orgId));
      }

      // Calculate balance adjustment if opening balance changes
      let currentBalanceAdjustment = 0;
      if (input.openingBalance !== undefined) {
        const oldOpening = Number(account.openingBalance);
        const newOpening = Number(input.openingBalance);
        currentBalanceAdjustment = newOpening - oldOpening;
      }

      const updatedFields: any = {
        ...input,
        updatedAt: new Date(),
      };

      if (currentBalanceAdjustment !== 0) {
        updatedFields.currentBalance = String(Number(account.currentBalance) + currentBalanceAdjustment);
      }

      const [updatedAccount] = await tx
        .update(bankAccounts)
        .set(updatedFields)
        .where(eq(bankAccounts.id, id))
        .returning();

      return updatedAccount;
    });
  }

  async deleteBankAccount(orgId: string, id: string) {
    const account = await this.getBankAccount(orgId, id);

    if (account.isDefault) {
      throw new ApiError(400, 'Cannot delete the default bank account. Set another account as default first.');
    }

    const [linkedPayment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.bankAccountId, id), sql`${payments.deletedAt} IS NULL`))
      .limit(1);

    if (linkedPayment) {
      throw new ApiError(400, 'Cannot delete this bank account because it has linked transactions. Please reassign or void the transactions first.');
    }

    const [deleted] = await db
      .update(bankAccounts)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bankAccounts.id, id))
      .returning();

    return deleted;
  }

  // ─── Payments CRUD ─────────────────────────────────────────────────────────

  async listPayments(
    orgId: string,
    filters: {
      page: number;
      limit: number;
      direction?: 'inbound' | 'outbound';
      contactId?: string;
      status?: string;
      q?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      startDate?: string;
      endDate?: string;
    }
  ) {
    const offset = getOffset(filters.page, filters.limit);
    const whereClauses = [eq(payments.orgId, orgId), sql`${payments.deletedAt} IS NULL`];

    if (filters.direction) {
      whereClauses.push(eq(payments.direction, filters.direction));
    }
    if (filters.contactId) {
      whereClauses.push(eq(payments.contactId, filters.contactId));
    }
    if (filters.status) {
      whereClauses.push(eq(payments.status, filters.status as any));
    }
    if (filters.startDate) {
      whereClauses.push(sql`DATE(${payments.paymentDate}) >= ${filters.startDate}::date`);
    }
    if (filters.endDate) {
      whereClauses.push(sql`DATE(${payments.paymentDate}) <= ${filters.endDate}::date`);
    }

    // Build base query
    let query = db
      .select({
        payment: payments,
        contactName: contacts.displayName,
        companyName: contacts.companyName,
        bankAccountName: bankAccounts.accountName,
      })
      .from(payments)
      .innerJoin(contacts, eq(payments.contactId, contacts.id))
      .leftJoin(bankAccounts, eq(payments.bankAccountId, bankAccounts.id));

    // Handle text queries matching numbers or contact names
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      whereClauses.push(
        or(
          sql`${payments.paymentNumber} ILIKE ${searchPattern}`,
          sql`${contacts.displayName} ILIKE ${searchPattern}`,
          sql`${contacts.companyName} ILIKE ${searchPattern}`,
          sql`${payments.transactionRef} ILIKE ${searchPattern}`
        ) as any
      );
    }

    // Count query
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .innerJoin(contacts, eq(payments.contactId, contacts.id))
      .where(and(...whereClauses));

    const total = Number(countResult?.count || 0);

    let orderByExpression: any = desc(payments.paymentDate);
    if (filters.sortBy) {
      const orderFn = filters.sortOrder === 'asc' ? asc : desc;
      if (filters.sortBy === 'paymentNumber') {
        orderByExpression = orderFn(payments.paymentNumber);
      } else if (filters.sortBy === 'paymentDate') {
        orderByExpression = orderFn(payments.paymentDate);
      } else if (filters.sortBy === 'contactName') {
        orderByExpression = orderFn(contacts.displayName);
      } else if (filters.sortBy === 'amount') {
        orderByExpression = orderFn(payments.amount);
      } else if (filters.sortBy === 'unusedAmount') {
        orderByExpression = orderFn(payments.unusedAmount);
      } else if (filters.sortBy === 'status') {
        orderByExpression = orderFn(payments.status);
      } else if (filters.sortBy === 'createdAt') {
        orderByExpression = orderFn(payments.createdAt);
      }
    } else {
      orderByExpression = [desc(payments.paymentDate), desc(payments.createdAt)];
    }

    // List fetch with pagination
    const rows = await query
      .where(and(...whereClauses))
      .orderBy(...(Array.isArray(orderByExpression) ? orderByExpression : [orderByExpression]))
      .limit(filters.limit)
      .offset(offset);

    // Map rows for consistent format
    const data = rows.map((r) => ({
      ...r.payment,
      contactName: r.contactName,
      companyName: r.companyName,
      bankAccountName: r.bankAccountName,
    }));

    return {
      data,
      pagination: buildPaginationMeta(total, filters.page, filters.limit),
    };
  }

  async getPaymentDetails(orgId: string, id: string) {
    const [row] = await db
      .select({
        payment: payments,
        contactName: contacts.displayName,
        companyName: contacts.companyName,
        bankAccountName: bankAccounts.accountName,
      })
      .from(payments)
      .innerJoin(contacts, eq(payments.contactId, contacts.id))
      .leftJoin(bankAccounts, eq(payments.bankAccountId, bankAccounts.id))
      .where(
        and(
          eq(payments.id, id),
          eq(payments.orgId, orgId),
          sql`${payments.deletedAt} IS NULL`
        )
      );

    if (!row) {
      throw new ApiError(404, 'Payment record not found');
    }

    // Get allocations
    const allocationsList = await db
      .select({
        id: paymentAllocations.id,
        amountApplied: paymentAllocations.amountApplied,
        appliedDate: paymentAllocations.appliedDate,
        notes: paymentAllocations.notes,
        invoiceId: paymentAllocations.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        totalAmount: invoices.totalAmount,
      })
      .from(paymentAllocations)
      .innerJoin(invoices, eq(paymentAllocations.invoiceId, invoices.id))
      .where(eq(paymentAllocations.paymentId, id));

    return {
      ...row.payment,
      contactName: row.contactName,
      companyName: row.companyName,
      bankAccountName: row.bankAccountName,
      allocations: allocationsList,
    };
  }

  async createPayment(orgId: string, userId: string, input: CreatePaymentInput) {
    const paymentAmount = Number(input.amount);
    const allocationsInput = input.allocations || [];

    // Calculate total allocations
    const totalAllocated = allocationsInput.reduce(
      (sum, alloc) => sum + Number(alloc.amountApplied),
      0
    );

    if (totalAllocated > paymentAmount) {
      throw new ApiError(400, 'Total allocated amount cannot exceed the payment amount');
    }

    const unusedAmount = paymentAmount - totalAllocated;

    return await db.transaction(async (tx) => {
      // 1. Generate payment number
      const paymentNumber = input.paymentNumber || await generatePaymentNumber(
        tx as any,
        orgId,
        input.direction,
        new Date(input.paymentDate)
      );

      // 2. Insert Payment header record
      const [newPayment] = await tx
        .insert(payments)
        .values({
          orgId,
          paymentNumber,
          paymentDate: input.paymentDate,
          direction: input.direction,
          contactId: input.contactId,
          amount: String(paymentAmount),
          unusedAmount: String(unusedAmount),
          currency: 'INR',
          exchangeRate: '1.0000',
          paymentMode: input.paymentMode,
          bankAccountId: input.bankAccountId || null,
          transactionRef: input.transactionRef || null,
          status: input.status || 'completed',
          chequeDate: input.chequeDate || null,
          notes: input.notes || null,
          createdBy: userId,
        })
        .returning();

      // 3. Update Bank account balance (if linked and completed)
      if (input.status === 'completed' && input.bankAccountId) {
        const [account] = await tx
          .select()
          .from(bankAccounts)
          .where(eq(bankAccounts.id, input.bankAccountId));

        if (account) {
          const balanceDiff = input.direction === 'inbound' ? paymentAmount : -paymentAmount;
          const newBalance = Number(account.currentBalance) + balanceDiff;
          await tx
            .update(bankAccounts)
            .set({ currentBalance: String(newBalance), updatedAt: new Date() })
            .where(eq(bankAccounts.id, account.id));
        }
      }

      // 4. Process allocations
      for (const alloc of allocationsInput) {
        // Fetch invoice
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(and(eq(invoices.id, alloc.invoiceId), eq(invoices.orgId, orgId)));

        if (!invoice) {
          throw new ApiError(404, `Invoice ${alloc.invoiceId} not found`);
        }

        const remainingBalance = Number((Number(invoice.totalAmount) - Number(invoice.amountPaid)).toFixed(2));
        const amountApplied = Number(Number(alloc.amountApplied).toFixed(2));

        if (amountApplied > remainingBalance) {
          throw new ApiError(
            400,
            `Cannot apply ₹${amountApplied} to invoice ${invoice.invoiceNumber}. Remaining balance is ₹${remainingBalance}.`
          );
        }

        // Insert allocation
        await tx.insert(paymentAllocations).values({
          orgId,
          paymentId: newPayment.id,
          invoiceId: invoice.id,
          amountApplied: String(amountApplied),
          appliedDate: input.paymentDate,
          notes: `Payment allocation for ${paymentNumber}`,
          createdBy: userId,
        });

        // Update invoice total payments & balances only if payment is completed
        if (input.status === 'completed') {
          const newPaid = Number((Number(invoice.amountPaid) + amountApplied).toFixed(2));
          const newDue = Math.max(0, Number((Number(invoice.totalAmount) - newPaid).toFixed(2)));

          let newStatus = invoice.status;
          if (newDue === 0) {
            newStatus = 'paid';
          } else if (newPaid > 0) {
            newStatus = 'partially_paid';
          }

          await tx
            .update(invoices)
            .set({
              amountPaid: String(newPaid),
              balanceDue: String(newDue),
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, invoice.id));
        }
      }

      if (input.status === 'completed') {
        await journalService.writePaymentJournal(tx, orgId, newPayment, userId);
      }

      return newPayment;
    });
  }

  async bulkCreatePayments(orgId: string, userId: string, inputs: CreatePaymentInput[]) {
    const results = [];
    for (const input of inputs) {
      try {
        const result = await this.createPayment(orgId, userId, input);
        results.push({ status: 'success', data: result });
      } catch (err: any) {
        results.push({ status: 'error', error: err.message || 'Failed to create payment' });
      }
    }
    return results;
  }

  async updatePaymentStatus(orgId: string, id: string, updateData: UpdatePaymentStatusInput, userId: string) {
    return await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.id, id), eq(payments.orgId, orgId)));

      if (!payment) {
        throw new ApiError(404, 'Payment not found');
      }

      if (updateData.status && payment.status === updateData.status && !updateData.chequeDate && !updateData.paymentDate && updateData.allocations === undefined) {
        return payment;
      }

      const newStatus = updateData.status || payment.status;
      const oldStatus = payment.status;
      const paymentAmount = Number(payment.amount);

      // Fetch allocations
      let allocationsList = await tx
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, id));

      const hasNewAllocations = updateData.allocations !== undefined;
      const statusChangedToCompleted = newStatus === 'completed' && oldStatus !== 'completed';
      const statusChangedFromCompleted = oldStatus === 'completed' && newStatus !== 'completed';
      const staysCompletedButAllocationsChanged = oldStatus === 'completed' && newStatus === 'completed' && hasNewAllocations;

      // 1. Revert bank balance if status changed FROM completed
      if (statusChangedFromCompleted) {
        if (payment.bankAccountId) {
          const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, payment.bankAccountId));
          if (account) {
            const balanceDiff = payment.direction === 'inbound' ? -paymentAmount : paymentAmount;
            const newBalance = Number(account.currentBalance) + balanceDiff;
            await tx.update(bankAccounts).set({ currentBalance: String(newBalance), updatedAt: new Date() }).where(eq(bankAccounts.id, account.id));
          }
        }
      }

      // 2. Revert invoice balances if it was completed and status changed OR allocations changed
      if (statusChangedFromCompleted || staysCompletedButAllocationsChanged) {
        for (const alloc of allocationsList) {
          const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, alloc.invoiceId));
          if (invoice) {
            const amountApplied = Number(alloc.amountApplied);
            const newPaid = Math.max(0, Number((Number(invoice.amountPaid) - amountApplied).toFixed(2)));
            const newDue = Number((Number(invoice.totalAmount) - newPaid).toFixed(2));
            let nextStatus = invoice.status;
            if (newPaid === 0) nextStatus = 'approved';
            else nextStatus = 'partially_paid';
            await tx.update(invoices).set({ amountPaid: String(newPaid), balanceDue: String(newDue), status: nextStatus, updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
          }
        }
      }

      // 3. Update Allocations in DB if new allocations provided
      let newUnusedAmount = Number(payment.unusedAmount);
      if (hasNewAllocations) {
        const newAllocations = updateData.allocations!;
        const totalAllocated = newAllocations.reduce((sum: number, a: any) => sum + Number(a.amountApplied), 0);
        if (totalAllocated > paymentAmount) throw new ApiError(400, 'Total allocated amount cannot exceed the payment amount');
        newUnusedAmount = paymentAmount - totalAllocated;

        await tx.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, id));
        allocationsList = [];
        for (const alloc of newAllocations) {
          const amountApplied = Number(Number(alloc.amountApplied).toFixed(2));
          if (amountApplied > 0) {
            const [newAlloc] = await tx.insert(paymentAllocations).values({
              orgId,
              paymentId: id,
              invoiceId: alloc.invoiceId,
              amountApplied: String(amountApplied),
              appliedDate: updateData.paymentDate || payment.paymentDate,
              notes: `Payment allocation for ${payment.paymentNumber}`,
              createdBy: userId,
            }).returning();
            allocationsList.push(newAlloc);
          }
        }
      }

      // 4. Apply bank balance if status changed TO completed
      if (statusChangedToCompleted) {
        if (payment.bankAccountId) {
          const [account] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, payment.bankAccountId));
          if (account) {
            const balanceDiff = payment.direction === 'inbound' ? paymentAmount : -paymentAmount;
            const newBalance = Number(account.currentBalance) + balanceDiff;
            await tx.update(bankAccounts).set({ currentBalance: String(newBalance), updatedAt: new Date() }).where(eq(bankAccounts.id, account.id));
          }
        }
      }

      // 5. Apply invoice balances if status changed TO completed OR stays completed but allocations changed
      if (statusChangedToCompleted || staysCompletedButAllocationsChanged) {
        for (const alloc of allocationsList) {
          const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, alloc.invoiceId));
          if (invoice) {
            const amountApplied = Number(alloc.amountApplied);
            const newPaid = Number((Number(invoice.amountPaid) + amountApplied).toFixed(2));
            const newDue = Math.max(0, Number((Number(invoice.totalAmount) - newPaid).toFixed(2)));
            let nextStatus = invoice.status;
            if (newDue === 0) nextStatus = 'paid';
            else if (newPaid > 0) nextStatus = 'partially_paid';
            await tx.update(invoices).set({ amountPaid: String(newPaid), balanceDue: String(newDue), status: nextStatus, updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
          }
        }
      }

      // 6. Journal Entries
      if (statusChangedToCompleted) {
        await journalService.writePaymentJournal(tx, orgId, payment as any, userId);
      } else if (statusChangedFromCompleted) {
        await journalService.writePaymentJournal(tx, orgId, payment as any, userId, true);
      }

      // Prepare update object
      const toUpdate: any = { updatedAt: new Date() };
      if (updateData.status) toUpdate.status = newStatus;
      if (updateData.chequeDate !== undefined) toUpdate.chequeDate = updateData.chequeDate;
      if (updateData.paymentDate !== undefined) toUpdate.paymentDate = updateData.paymentDate;
      if (hasNewAllocations) toUpdate.unusedAmount = String(newUnusedAmount);

      // Update payment status and dates
      const [updatedPayment] = await tx
        .update(payments)
        .set(toUpdate)
        .where(eq(payments.id, id))
        .returning();

      return updatedPayment;
    });
  }

  async deletePayment(orgId: string, id: string) {
    const payment = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.orgId, orgId)));

    if (payment.length === 0) {
      throw new ApiError(404, 'Payment not found');
    }

    const payRec = payment[0];

    if (payRec.status === 'cancelled') {
      throw new ApiError(400, 'Payment is already cancelled');
    }

    return await db.transaction(async (tx) => {
      // 1. Revert bank balance
      if (payRec.bankAccountId) {
        const [account] = await tx
          .select()
          .from(bankAccounts)
          .where(eq(bankAccounts.id, payRec.bankAccountId));

        if (account) {
          const balanceDiff = payRec.direction === 'inbound' ? -Number(payRec.amount) : Number(payRec.amount);
          const newBalance = Number(account.currentBalance) + balanceDiff;
          await tx
            .update(bankAccounts)
            .set({ currentBalance: String(newBalance), updatedAt: new Date() })
            .where(eq(bankAccounts.id, account.id));
        }
      }

      // 2. Fetch allocations to revert invoice balances
      const allocationsList = await tx
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, id));

      for (const alloc of allocationsList) {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(eq(invoices.id, alloc.invoiceId));

        if (invoice) {
          const amountApplied = Number(alloc.amountApplied);
          const newPaid = Math.max(0, Number((Number(invoice.amountPaid) - amountApplied).toFixed(2)));
          const newDue = Number((Number(invoice.totalAmount) - newPaid).toFixed(2));

          let newStatus = invoice.status;
          if (newPaid === 0) {
            newStatus = 'approved'; // Revert back to approved/approved state
          } else {
            newStatus = 'partially_paid';
          }

          await tx
            .update(invoices)
            .set({
              amountPaid: String(newPaid),
              balanceDue: String(newDue),
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, invoice.id));
        }
      }

      // 3. Delete allocation records
      await tx.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, id));

      // 4. Void the payment record
      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: 'cancelled',
          unusedAmount: '0.00',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, id))
        .returning();

      await journalService.writePaymentJournal(tx, orgId, updatedPayment, null, true);

      return updatedPayment;
    });
  }
}

export const paymentService = new PaymentService();
