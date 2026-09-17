import { db } from '../../db/index.js';
import { eq, and, sql, desc, or, isNull, gte, lte, inArray, notInArray } from 'drizzle-orm';
import { orders } from '../../db/schema/orders.js';
import { invoices, invoiceLineItems } from '../../db/schema/invoices.js';
import { payments, creditNoteAllocations } from '../../db/schema/payments.js';
import { products, productVariants, productImages } from '../../db/schema/products.js';
import { contacts } from '../../db/schema/contacts.js';
import { priceListItems } from '../../db/schema/price-lists.js';
import { ApiError } from '../../utils/api-error.js';

export const portalService = {
  async getOrders(orgId: string, contactId: string) {
    return db.query.orders.findMany({
      where: and(
        eq(orders.orgId, orgId),
        eq(orders.contactId, contactId)
      ),
      with: {
        items: {
          with: {
            product: true,
            variant: true,
          }
        },
      },
      orderBy: [desc(orders.orderDate)],
    });
  },

  async getInvoices(orgId: string, contactId: string) {
    return db.query.invoices.findMany({
      where: and(
        eq(invoices.orgId, orgId),
        eq(invoices.contactId, contactId)
      ),
      with: {
        lineItems: {
          with: {
            product: true,
            variant: true,
          }
        },
      },
      orderBy: [desc(invoices.invoiceDate)],
    });
  },

  async getPayments(orgId: string, contactId: string) {
    return db.query.payments.findMany({
      where: and(
        eq(payments.orgId, orgId),
        eq(payments.contactId, contactId)
      ),
      orderBy: [desc(payments.paymentDate)],
    });
  },

  async getProducts(orgId: string, contactId: string) {
    // Fetch all sales invoice line items for this customer
    const billedItems = await db
      .select({
        productId: invoiceLineItems.productId,
        variantId: invoiceLineItems.variantId,
        unitPrice: invoiceLineItems.unitPrice,
        quantity: invoiceLineItems.quantity,
        invoiceDate: invoices.invoiceDate,
        invoiceNumber: invoices.invoiceNumber,
        productName: products.name,
        sku: productVariants.sku,
        mrp: productVariants.mrp,
        imageUrl: productImages.url,
      })
      .from(invoiceLineItems)
      .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
      .innerJoin(products, eq(invoiceLineItems.productId, products.id))
      .innerJoin(productVariants, eq(invoiceLineItems.variantId, productVariants.id))
      .leftJoin(
        productImages,
        and(
          eq(productImages.productId, products.id),
          eq(productImages.isPrimary, true)
        )
      )
      .where(
        and(
          eq(invoices.orgId, orgId),
          eq(invoices.contactId, contactId),
          eq(invoices.documentType, 'sales_invoice')
        )
      )
      .orderBy(desc(invoices.invoiceDate));

    // Process and group by product variant
    const productMap = new Map<string, any>();

    for (const item of billedItems) {
      if (!item.variantId) continue;
      
      const key = item.variantId;
      if (!productMap.has(key)) {
        productMap.set(key, {
          productId: item.productId,
          variantId: item.variantId,
          name: item.productName,
          sku: item.sku,
          mrp: Number(item.mrp || 0),
          imageUrl: item.imageUrl,
          finalPrice: Number(item.unitPrice), // Set latest price as finalPrice (because of order by desc)
          priceHistory: [],
        });
      }
      
      const product = productMap.get(key);
      product.priceHistory.push({
        date: item.invoiceDate,
        invoiceNumber: item.invoiceNumber,
        price: Number(item.unitPrice),
        quantity: Number(item.quantity),
      });
    }

    return Array.from(productMap.values());
  },

  async getLedger(orgId: string, contactId: string, fromDate?: string, toDate?: string) {
    // Build date conditions for the period
    const invoiceConditions: any[] = [
      eq(invoices.orgId, orgId),
      eq(invoices.contactId, contactId),
      inArray(invoices.documentType, ['sales_invoice', 'credit_note', 'debit_note']),
      notInArray(invoices.status, ['draft', 'void', 'cancelled']),
    ];
    const paymentConditions: any[] = [
      eq(payments.orgId, orgId),
      eq(payments.contactId, contactId),
      notInArray(payments.status, ['cancelled', 'failed']),
    ];

    if (fromDate) {
      invoiceConditions.push(gte(invoices.invoiceDate, fromDate));
      paymentConditions.push(gte(payments.paymentDate, fromDate));
    }
    if (toDate) {
      invoiceConditions.push(lte(invoices.invoiceDate, toDate));
      paymentConditions.push(lte(payments.paymentDate, toDate));
    }

    // Build opening balance conditions (all transactions BEFORE fromDate)
    const openingInvoiceConditions: any[] = [
      eq(invoices.orgId, orgId),
      eq(invoices.contactId, contactId),
      inArray(invoices.documentType, ['sales_invoice', 'credit_note', 'debit_note']),
      notInArray(invoices.status, ['draft', 'void', 'cancelled']),
    ];
    const openingPaymentConditions: any[] = [
      eq(payments.orgId, orgId),
      eq(payments.contactId, contactId),
      notInArray(payments.status, ['cancelled', 'failed']),
    ];
    if (fromDate) {
      // strictly less than fromDate (use sql for strict < on date strings)
      openingInvoiceConditions.push(sql`${invoices.invoiceDate} < ${fromDate}`);
      openingPaymentConditions.push(sql`${payments.paymentDate} < ${fromDate}`);
    }

    // Fetch period rows + opening rows + contact opening balance in parallel
    const [invoiceRows, paymentRows, openingInvoices, openingPayments, contact] = await Promise.all([
      db.query.invoices.findMany({
        where: and(...invoiceConditions),
        columns: { id: true, invoiceNumber: true, invoiceDate: true, totalAmount: true, balanceDue: true, status: true, documentType: true },
        orderBy: [desc(invoices.invoiceDate)],
      }),
      db.query.payments.findMany({
        where: and(...paymentConditions),
        columns: { id: true, paymentNumber: true, paymentDate: true, amount: true, paymentMode: true, status: true },
        orderBy: [desc(payments.paymentDate)],
      }),
      fromDate ? db.query.invoices.findMany({
        where: and(...openingInvoiceConditions),
        columns: { totalAmount: true, documentType: true },
      }) : Promise.resolve([]),
      fromDate ? db.query.payments.findMany({
        where: and(...openingPaymentConditions),
        columns: { amount: true },
      }) : Promise.resolve([]),
      db.query.contacts.findFirst({
        where: and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)),
        columns: { openingBalance: true },
      }),
    ]);

    // Opening balance = contact opening balance + sum of all debits - sum of all credits before period
    const baseOpeningBalance = Number(contact?.openingBalance || 0);
    const openingBalance = baseOpeningBalance +
      openingInvoices.reduce((s, i) => {
        if (i.documentType === 'credit_note') return s - Number(i.totalAmount); // credit notes reduce what customer owes
        if (i.documentType === 'debit_note') return s + Number(i.totalAmount); // debit notes increase what customer owes
        return s + Number(i.totalAmount); // sales invoices increase what customer owes
      }, 0) -
      openingPayments.reduce((s, p) => s + Number(p.amount), 0);

    // Combine into ledger entries
    // Credit Note Allocations — fetch what credit was applied to invoices in this period
    const cnAllocConditions: any[] = [
      eq(creditNoteAllocations.orgId, orgId),
    ];
    // We need to find allocations where the invoice belongs to this contact
    // Join via invoice table filtered by contactId
    const cnAllocRows = await db.query.creditNoteAllocations.findMany({
      where: and(...cnAllocConditions),
      with: {
        creditNote: { columns: { invoiceNumber: true, contactId: true, invoiceDate: true } },
        invoice: { columns: { contactId: true } },
      },
    });
    // Filter to this contact's invoices only
    const filteredCnAllocs = cnAllocRows.filter(
      (a) => a.creditNote.contactId === contactId || a.invoice.contactId === contactId
    );

    const entries: any[] = [
      ...invoiceRows.map(inv => ({
        id: inv.id,
        date: inv.invoiceDate,
        type: inv.documentType, // 'sales_invoice', 'credit_note', 'debit_note'
        label: inv.documentType === 'credit_note' ? 'Credit Note'
             : inv.documentType === 'debit_note' ? 'Debit Note'
             : 'Sales Invoice',
        reference: inv.invoiceNumber,
        // Debit = increases amount customer owes (invoice + debit note)
        // Credit = decreases amount customer owes (credit note)
        debit: (inv.documentType === 'sales_invoice' || inv.documentType === 'debit_note') ? Number(inv.totalAmount) : 0,
        credit: inv.documentType === 'credit_note' ? Number(inv.totalAmount) : 0,
        status: inv.status,
        balanceDue: Number(inv.balanceDue),
      })),
      ...paymentRows.map(pay => ({
        id: pay.id,
        date: pay.paymentDate,
        type: 'payment' as const,
        label: 'Payment Received',
        reference: pay.paymentNumber,
        debit: 0,
        credit: Number(pay.amount),
        status: pay.status,
        paymentMode: pay.paymentMode,
      })),
    ];

    // Sort chronologically (oldest first for running balance)
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute running balance starting from opening balance
    let runningBalance = openingBalance;
    for (const entry of entries) {
      runningBalance = Number((runningBalance + entry.debit - entry.credit).toFixed(2));
      entry.runningBalance = runningBalance;
    }

    // Keep ascending order for display (oldest first)

    return {
      entries,
      summary: {
        openingBalance: Number(openingBalance.toFixed(2)),
        totalInvoiced: Number(invoiceRows.reduce((s, i) => s + (i.documentType === 'sales_invoice' ? Number(i.totalAmount) : 0), 0).toFixed(2)),
        totalCreditNotes: Number(invoiceRows.reduce((s, i) => s + (i.documentType === 'credit_note' ? Number(i.totalAmount) : 0), 0).toFixed(2)),
        totalDebitNotes: Number(invoiceRows.reduce((s, i) => s + (i.documentType === 'debit_note' ? Number(i.totalAmount) : 0), 0).toFixed(2)),
        totalPaid: Number(paymentRows.reduce((s, p) => s + Number(p.amount), 0).toFixed(2)),
        closingBalance: Number(runningBalance.toFixed(2)),
      },
    };
  },

  async getProfile(orgId: string, contactId: string) {
    const profile = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)),
      with: {
        addresses: true,
        paymentTerm: true,
      },
    });

    if (!profile) {
      throw ApiError.notFound('Profile not found');
    }

    return profile;
  },
};
