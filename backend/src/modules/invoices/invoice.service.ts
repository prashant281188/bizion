import { db } from '../../db/index.js';
import { invoices, invoiceLineItems } from '../../db/schema/invoices.js';
import { organizations } from '../../db/schema/organizations.js';
import { contacts, contactAddresses } from '../../db/schema/contacts.js';
import { taxRates, transporters } from '../../db/schema/masters.js';
import { warehouses, inventory } from '../../db/schema/inventory.js';
import { goodsReceipts } from '../../db/schema/goods-receipts.js';
import { dispatches, dispatchItems } from '../../db/schema/dispatches.js';
import { calculateLineItemGst, isInterStateSupply } from '../../utils/gst-calculator.js';
import { generateInvoiceNumber } from '../../utils/invoice-number.js';
import { eq, and, desc, asc, sql, like, or, inArray, isNull } from 'drizzle-orm';
import { journalService } from '../../utils/journal.service.js';
import { ApiError } from '../../utils/api-error.js';
import type { CreateInvoiceInput, UpdateInvoiceInput } from './invoice.schema.js';
import { products, productVariants, productVariantPriceHistory, productPricingRules } from '../../db/schema/products.js';
import { contactCustomPrices } from '../../db/schema/contact-prices.js';
import { orders, orderItems } from '../../db/schema/orders.js';

// Helper to adjust stock levels in database
async function adjustStockHelper(tx: any, orgId: string, productId: string, variantId: string | null, quantityChange: number) {
  // 1. Resolve default warehouse
  const [defaultWarehouse] = await tx
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.orgId, orgId), eq(warehouses.isDefault, true)))
    .limit(1);

  const [firstWarehouse] = await tx
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(eq(warehouses.orgId, orgId))
    .limit(1);

  const warehouseId = defaultWarehouse?.id || firstWarehouse?.id;
  if (!warehouseId) {
    console.warn(`No warehouse found for org ${orgId}. Skipping stock adjustment.`);
    return;
  }

  // 2. Find or create inventory entry
  let invRecord;
  if (variantId) {
    [invRecord] = await tx
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.orgId, orgId),
          eq(inventory.warehouseId, warehouseId),
          eq(inventory.productId, productId),
          eq(inventory.variantId, variantId)
        )
      )
      .limit(1);
  } else {
    [invRecord] = await tx
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.orgId, orgId),
          eq(inventory.warehouseId, warehouseId),
          eq(inventory.productId, productId),
          sql`${inventory.variantId} IS NULL`
        )
      )
      .limit(1);
  }

  if (invRecord) {
    // Update quantityOnHand
    await tx
      .update(inventory)
      .set({
        quantityOnHand: invRecord.quantityOnHand + quantityChange,
        updatedAt: new Date(),
      })
      .where(eq(inventory.id, invRecord.id));
  } else {
    // Insert new inventory entry
    await tx.insert(inventory).values({
      orgId,
      warehouseId,
      productId,
      variantId: variantId || null,
      quantityOnHand: quantityChange,
      quantityReserved: 0,
    });
  }
}

async function adjustInvoiceStock(tx: any, orgId: string, documentType: string, lineItems: any[], revert: boolean = false) {
  for (const line of lineItems) {
    if (!line.productId) continue; // Skip custom non-catalog items with no productId

    const qty = Number(line.quantity || 0);
    if (qty <= 0) continue;

    let multiplier = 1;
    // Determine sign of change based on document type
    if (documentType === 'sales_invoice' || documentType === 'debit_note') {
      // Sales reduces stock, debit note (purchase return) reduces stock
      multiplier = -1;
    } else if (documentType === 'purchase_invoice' || documentType === 'credit_note') {
      // Purchase increases stock, credit note (sales return) increases stock
      multiplier = 1;
    }

    // If reverting, flip the sign
    if (revert) {
      multiplier *= -1;
    }

    const quantityChange = qty * multiplier;
    await adjustStockHelper(tx, orgId, line.productId, line.variantId, quantityChange);
  }
}

export const invoiceService = {
  /**
   * List all invoices for an organization with paginated filter checks.
   */
  async listInvoices(orgId: string, filters: {
    type?: string;
    status?: string;
    contactId?: string;
    orderId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, filters.page);
    const limit = Math.max(1, filters.limit);
    const offset = (page - 1) * limit;

    const queryFilters: any[] = [eq(invoices.orgId, orgId)];

    if (filters.startDate) {
      queryFilters.push(sql`${invoices.invoiceDate} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      queryFilters.push(sql`${invoices.invoiceDate} <= ${filters.endDate}`);
    }

    if (filters.type) {
      const types = filters.type.split(',').map((t) => t.trim());
      if (types.length > 1) {
        queryFilters.push(or(...types.map((t) => eq(invoices.documentType, t as any))));
      } else {
        queryFilters.push(eq(invoices.documentType, types[0] as any));
      }
    }
    if (filters.status) {
      const statuses = filters.status.split(',').map((s) => s.trim());
      if (statuses.length > 1) {
        queryFilters.push(or(...statuses.map((s) => eq(invoices.status, s as any))));
      } else {
        queryFilters.push(eq(invoices.status, statuses[0] as any));
      }
    }
    if (filters.contactId) {
      queryFilters.push(eq(invoices.contactId, filters.contactId));
    }
    if (filters.orderId) {
      queryFilters.push(eq(invoices.orderId, filters.orderId));
    }
    if (filters.search) {
      queryFilters.push(
        or(
          like(invoices.invoiceNumber, `%${filters.search}%`),
          like(contacts.displayName, `%${filters.search}%`),
          like(contacts.companyName, `%${filters.search}%`)
        )
      );
    }

    const whereClause = and(...queryFilters);

    // Get Total Count
    const [countResult] = await db
      .select({ count: sql<number>`count(${invoices.id})` })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(whereClause);

    // Get Data
    const data = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        documentType: invoices.documentType,
        status: invoices.status,
        totalAmount: invoices.totalAmount,
        amountPaid: invoices.amountPaid,
        balanceDue: invoices.balanceDue,
        contactName: contacts.displayName,
        companyName: contacts.companyName,
      })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(whereClause)
      .orderBy(
        (() => {
          const orderFn = filters.sortOrder === 'asc' ? asc : desc;
          if (filters.sortBy === 'invoiceNumber') return orderFn(invoices.invoiceNumber);
          if (filters.sortBy === 'invoiceDate') return orderFn(invoices.invoiceDate);
          if (filters.sortBy === 'dueDate') return orderFn(invoices.dueDate);
          if (filters.sortBy === 'totalAmount') return orderFn(invoices.totalAmount);
          if (filters.sortBy === 'balanceDue') return orderFn(invoices.balanceDue);
          if (filters.sortBy === 'contactName') return orderFn(contacts.displayName);
          if (filters.sortBy === 'status') return orderFn(invoices.status);
          if (filters.sortBy === 'createdAt') return orderFn(invoices.createdAt);
          return orderFn(invoices.invoiceDate);
        })()
      )
      .limit(limit)
      .offset(offset);

    return {
      data,
      pagination: {
        total: Number(countResult?.count || 0),
        page,
        limit,
      },
    };
  },

  /**
   * Retrieve a specific invoice profile by ID with joins on lines & addresses.
   */
  async getInvoiceById(orgId: string, invoiceId: string) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)))
      .limit(1);

    if (!invoice) {
      throw ApiError.notFound('Invoice profile not found');
    }

    // Get line items
    const lines = await db
      .select({
        id: invoiceLineItems.id,
        lineNumber: invoiceLineItems.lineNumber,
        productId: invoiceLineItems.productId,
        variantId: invoiceLineItems.variantId,
        description: invoiceLineItems.description,
        hsnCode: invoiceLineItems.hsnCode,
        quantity: invoiceLineItems.quantity,
        unitPrice: invoiceLineItems.unitPrice,
        discountType: invoiceLineItems.discountType,
        discountValue: invoiceLineItems.discountValue,
        discountAmount: invoiceLineItems.discountAmount,
        taxableValue: invoiceLineItems.taxableValue,
        taxRateId: invoiceLineItems.taxRateId,
        taxRatePercent: invoiceLineItems.taxRatePercent,
        cgstRate: invoiceLineItems.cgstRate,
        cgstAmount: invoiceLineItems.cgstAmount,
        sgstRate: invoiceLineItems.sgstRate,
        sgstAmount: invoiceLineItems.sgstAmount,
        igstRate: invoiceLineItems.igstRate,
        igstAmount: invoiceLineItems.igstAmount,
        totalAmount: invoiceLineItems.totalAmount,
      })
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId))
      .orderBy(invoiceLineItems.lineNumber);

    // Get Contact details
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, invoice.contactId))
      .limit(1);

    // Get address profiles
    const [billingAddress] = invoice.billingAddressId
      ? await db.select().from(contactAddresses).where(eq(contactAddresses.id, invoice.billingAddressId)).limit(1)
      : [null];

    const [shippingAddress] = invoice.shippingAddressId
      ? await db.select().from(contactAddresses).where(eq(contactAddresses.id, invoice.shippingAddressId)).limit(1)
      : [null];

    const [transporter] = invoice.transporterId
      ? await db.select().from(transporters).where(eq(transporters.id, invoice.transporterId)).limit(1)
      : [null];

    return {
      ...invoice,
      contact,
      billingAddress,
      shippingAddress,
      transporter,
      lineItems: lines,
    };
  },

  /**
   * Get chronological bounds (prev and next invoice) for a specific invoice number.
   * Useful for frontend validation when skipping numbers.
   */
  async getSequenceBounds(orgId: string, documentType: string, invoiceNumber: string) {
    const [prevInvoice] = await db
      .select({ invoiceDate: invoices.invoiceDate, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.documentType, documentType as any), sql`${invoices.invoiceNumber} < ${invoiceNumber}`))
      .orderBy(desc(invoices.invoiceNumber))
      .limit(1);

    const [nextInvoice] = await db
      .select({ invoiceDate: invoices.invoiceDate, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.documentType, documentType as any), sql`${invoices.invoiceNumber} > ${invoiceNumber}`))
      .orderBy(asc(invoices.invoiceNumber))
      .limit(1);

    return {
      prev: prevInvoice || null,
      next: nextInvoice || null
    };
  },

  /**
   * Create a new transaction invoice.
   */
  async createInvoice(orgId: string, createdBy: string, input: CreateInvoiceInput) {
    // 1. Check if contact exists
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)))
      .limit(1);

    if (!contact) {
      throw ApiError.notFound('Recipient contact not found');
    }

    if ((input.documentType === 'sales_invoice' || input.documentType === 'credit_note') && contact.type === 'vendor') {
      throw new ApiError(400, 'Cannot create a sales document for a vendor contact');
    }
    if ((input.documentType === 'purchase_invoice' || input.documentType === 'debit_note') && contact.type === 'customer') {
      throw new ApiError(400, 'Cannot create a purchase document for a customer contact');
    }

    // 2. Enforce chronological sequence of invoice dates based on invoice number (supports skipped numbers)
    if (input.documentType === 'sales_invoice' && input.invoiceDate && input.invoiceNumber) {
      const bounds = await this.getSequenceBounds(orgId, 'sales_invoice', input.invoiceNumber);
      
      if (bounds.prev?.invoiceDate && new Date(input.invoiceDate) < new Date(bounds.prev.invoiceDate)) {
        throw new ApiError(400, `Invoice date (${input.invoiceDate}) cannot be earlier than previous invoice (${bounds.prev.invoiceNumber} dated ${bounds.prev.invoiceDate})`);
      }
      
      if (bounds.next?.invoiceDate && new Date(input.invoiceDate) > new Date(bounds.next.invoiceDate)) {
        throw new ApiError(400, `Invoice date (${input.invoiceDate}) cannot be later than next invoice (${bounds.next.invoiceNumber} dated ${bounds.next.invoiceDate})`);
      }
    }

    // 3. Fetch organization's registered stateCode to decide if interstate supply
    const [org] = await db
      .select({ stateCode: organizations.stateCode })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const supplierStateCode = org?.stateCode || '27'; // Default to Maharashtra if unset
    const buyerStateCode = input.placeOfSupplyCode || supplierStateCode;
    const isInterState = input.isInterState !== undefined && input.isInterState !== null
      ? input.isInterState
      : isInterStateSupply(supplierStateCode, buyerStateCode);

    // 3. Process Line Items and Calculate GST Splits
    let subtotal = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let cessAmount = 0;
    let totalTaxAmount = 0;

    const parsedLines: any[] = [];
    const customPricesToUpsert: any[] = [];
    const purchasePricesToUpdate: any[] = [];

    // Fetch products and variants to compare global selling price
    const productIds = input.lineItems.map((li) => li.productId).filter(Boolean) as string[];
    const variantIds = input.lineItems.map((li) => li.variantId).filter(Boolean) as string[];
    const fetchedProducts = productIds.length > 0 ? await db.select().from(products).where(inArray(products.id, productIds)) : [];
    const fetchedVariants = variantIds.length > 0 ? await db.select().from(productVariants).where(inArray(productVariants.id, variantIds)) : [];
    const fetchedPricingRules = productIds.length > 0
      ? await db.select().from(productPricingRules).where(and(inArray(productPricingRules.productId, productIds), isNull(productPricingRules.priceListId)))
      : [];

    for (let i = 0; i < input.lineItems.length; i++) {
      const line = input.lineItems[i];
      const qty = Number(line.quantity);
      const price = Number(line.unitPrice);
      const discVal = Number(line.discountValue || 0);

      const documentType = input.documentType || 'sales_invoice';

      // Party Rate Setup Tracking
      if (documentType === 'sales_invoice') {
        let globalPrice = 0;
        if (line.variantId) {
          const rule = fetchedPricingRules.find(r => r.productId === line.productId && r.variantId === line.variantId);
          if (rule) globalPrice = Number(rule.listPrice);
        } else if (line.productId) {
          const rule = fetchedPricingRules.find(r => r.productId === line.productId && !r.variantId);
          if (rule) globalPrice = Number(rule.listPrice);
        }

        if (globalPrice > 0 && price !== globalPrice && line.productId) {
          customPricesToUpsert.push({
            orgId,
            contactId: input.contactId,
            productId: line.productId,
            variantId: line.variantId || null,
            customPrice: price.toFixed(2),
          });
        }
      }

      // Purchase Rate Setup Tracking
      if (documentType === 'purchase_invoice') {
        let globalCost = 0;
        let pOrV: any = null;
        let isVar = false;
        if (line.variantId) {
          const v = fetchedVariants.find((v) => v.id === line.variantId);
          if (v) {
             globalCost = Number(v.valuationCost);
             pOrV = v;
             isVar = true;
          }
        } else if (line.productId) {
          const p = fetchedProducts.find((p) => p.id === line.productId);
          if (p) {
             globalCost = Number(p.valuationCost);
             pOrV = p;
             isVar = false;
          }
        }

        if (price !== globalCost && pOrV) {
          purchasePricesToUpdate.push({
            productOrVariant: pOrV,
            isVariant: isVar,
            newCostPrice: price.toFixed(2),
          });
        }
      }

      // Look up tax rate from database
      let taxRatePercent = 0;
      if (line.taxRateId) {
        const [tr] = await db
          .select({ ratePercentage: taxRates.ratePercentage })
          .from(taxRates)
          .where(and(eq(taxRates.orgId, orgId), eq(taxRates.id, line.taxRateId)))
          .limit(1);
        if (tr) {
          taxRatePercent = Number(tr.ratePercentage);
        }
      }

      // Calculate line discount amount
      const lineTotal = qty * price;
      let lineDiscount = 0;
      if (line.discountType === 'percentage') {
        lineDiscount = (lineTotal * discVal) / 100;
      } else {
        lineDiscount = discVal;
      }

      // Calculate GST breakdown using the helper utility
      const gstDetails = calculateLineItemGst(
        price,
        qty,
        lineDiscount,
        taxRatePercent,
        supplierStateCode,
        buyerStateCode,
        0, // cessRate
        isInterState
      );

      subtotal += lineTotal;
      discountAmount += lineDiscount;
      taxableAmount += gstDetails.taxableValue;
      cgstAmount += gstDetails.cgstAmount;
      sgstAmount += gstDetails.sgstAmount;
      igstAmount += gstDetails.igstAmount;
      cessAmount += gstDetails.cessAmount;
      totalTaxAmount += gstDetails.totalTax;

      parsedLines.push({
        orgId,
        lineNumber: i + 1,
        productId: line.productId || null,
        variantId: line.variantId || null,
        description: line.description,
        hsnCode: line.hsnCode || null,
        quantity: qty.toFixed(2),
        unitPrice: price.toFixed(2),
        discountType: line.discountType || 'percentage',
        discountValue: discVal.toFixed(2),
        discountAmount: lineDiscount.toFixed(2),
        taxableValue: gstDetails.taxableValue.toFixed(2),
        taxRateId: line.taxRateId || null,
        taxRatePercent: taxRatePercent.toFixed(2),
        cgstRate: gstDetails.cgstRate.toFixed(2),
        cgstAmount: gstDetails.cgstAmount.toFixed(2),
        sgstRate: gstDetails.sgstRate.toFixed(2),
        sgstAmount: gstDetails.sgstAmount.toFixed(2),
        igstRate: gstDetails.igstRate.toFixed(2),
        igstAmount: gstDetails.igstAmount.toFixed(2),
        cessRate: gstDetails.cessRate.toFixed(2),
        cessAmount: gstDetails.cessAmount.toFixed(2),
        totalAmount: gstDetails.totalAmount.toFixed(2),
      });
    }

    const round = Number(input.roundOff || 0);
    const finalTotal = taxableAmount + totalTaxAmount + round;

    // 4. Generate next serial sequential invoice number (or use provided custom number)
    const documentType = input.documentType || 'sales_invoice';
    const invoiceNumber = input.invoiceNumber || await generateInvoiceNumber(
      db,
      orgId,
      documentType,
      new Date(input.invoiceDate)
    );

    // 5. Transaction Execute
    const result = await db.transaction(async (tx) => {
      // Insert Invoice Header
      const [newInvoice] = await tx
        .insert(invoices)
        .values({
          orgId,
          documentType,
          invoiceNumber,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate || null,
          referenceInvoiceId: input.referenceInvoiceId || null,
          referenceNumber: input.referenceNumber || null,
          contactId: input.contactId,
          billingAddressId: input.billingAddressId || null,
          shippingAddressId: input.shippingAddressId || null,
          supplyType: input.supplyType || 'b2b',
          placeOfSupplyCode: buyerStateCode,
          isInterState,
          reverseCharge: input.reverseCharge ?? false,
          subtotal: subtotal.toFixed(2),
          discountAmount: discountAmount.toFixed(2),
          taxableAmount: taxableAmount.toFixed(2),
          cgstAmount: cgstAmount.toFixed(2),
          sgstAmount: sgstAmount.toFixed(2),
          igstAmount: igstAmount.toFixed(2),
          cessAmount: cessAmount.toFixed(2),
          totalTaxAmount: totalTaxAmount.toFixed(2),
          roundOff: round.toFixed(2),
          totalAmount: finalTotal.toFixed(2),
          balanceDue: finalTotal.toFixed(2),
          currency: input.currency || 'INR',
          exchangeRate: input.exchangeRate ? Number(input.exchangeRate).toFixed(4) : '1.0000',
          paymentTermId: input.paymentTermId || null,
          transporterId: input.transporterId || null,
          ewayBillNumber: input.ewayBillNumber || null,
          ewayBillDate: input.ewayBillDate || null,
          transportMode: input.transportMode || null,
          vehicleNumber: input.vehicleNumber || null,
          status: input.status || 'draft',
          notes: input.notes || null,
          termsAndConditions: input.termsAndConditions || null,
          customerNotes: input.customerNotes || null,
          customFields: input.customFields || {},
          orderId: (input as any).orderId || null,
          createdBy,
        })
        .returning();

      // Insert Lines
      const finalLines = parsedLines.map((line) => ({
        ...line,
        invoiceId: newInvoice.id,
      }));
      await tx.insert(invoiceLineItems).values(finalLines);

      // Adjust stock levels (skip for drafts, cancelled, or purchase invoices linked to a PO via GRNs)
      const isPoLinkedPurchaseInvoice = newInvoice.documentType === 'purchase_invoice' && !!(input as any).orderId;
      if (newInvoice.status !== 'cancelled' && newInvoice.status !== 'draft' && !isPoLinkedPurchaseInvoice) {
        await adjustInvoiceStock(tx, orgId, newInvoice.documentType, finalLines);
      }

      // Link GRN if grnId was provided
      if ((input as any).grnId) {
        const [existingGrn] = await tx.select({ invoiceId: goodsReceipts.invoiceId })
          .from(goodsReceipts)
          .where(and(eq(goodsReceipts.id, (input as any).grnId), eq(goodsReceipts.orgId, orgId)));
          
        if (existingGrn && existingGrn.invoiceId) {
          throw ApiError.badRequest('An invoice has already been generated for this goods receipt');
        }

        await tx.update(goodsReceipts)
          .set({ invoiceId: newInvoice.id })
          .where(and(eq(goodsReceipts.id, (input as any).grnId), eq(goodsReceipts.orgId, orgId)));
      }

      // Auto-generate dispatch for sales invoices without an existing dispatch
      if (
        newInvoice.documentType === 'sales_invoice' && 
        newInvoice.status !== 'cancelled' &&
        !newInvoice.referenceNumber
      ) {
        const dispatchNumber = `DSP-A${String(Date.now()).slice(-6)}`;
        const dispatchStatus = newInvoice.status === 'draft' ? 'draft' : 'delivered';
        
        const [dispatch] = await tx.insert(dispatches).values({
          orgId,
          dispatchNumber,
          status: dispatchStatus as any,
          orderId: (input as any).orderId || null,
          contactId: input.contactId || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();

        let orderItemsList: any[] = [];
        if ((input as any).orderId) {
          orderItemsList = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, (input as any).orderId));
        }

        const dItemsToInsert = finalLines.map(line => {
          const matchedOi = orderItemsList.find(oi => 
            oi.productId === line.productId && 
            (line.variantId ? oi.variantId === line.variantId : !oi.variantId)
          );

          return {
            dispatchId: dispatch.id,
            orderItemId: matchedOi?.id || null,
            productId: line.productId || null,
            variantId: line.variantId || null,
            quantity: Math.round(Number(line.quantity)),
            unitPrice: line.unitPrice,
          };
        });

        if (dItemsToInsert.length > 0) {
          await tx.insert(dispatchItems).values(dItemsToInsert);
        }

        // Link the dispatch back to the invoice referenceNumber
        await tx.update(invoices).set({ referenceNumber: dispatchNumber }).where(eq(invoices.id, newInvoice.id));
      }

      // Update linked sales order status based on actual total dispatched quantity
      if ((input as any).orderId) {
        const [targetOrder] = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, (input as any).orderId), eq(orders.orgId, orgId)))
          .limit(1);

        if (targetOrder && targetOrder.type === 'sales') {
          const orderDispatches = await tx
            .select({ id: dispatches.id })
            .from(dispatches)
            .where(and(eq(dispatches.orderId, targetOrder.id), eq(dispatches.orgId, orgId)));
          
          const dispatchIds = orderDispatches.map(d => d.id);

          const allOrderItems = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, targetOrder.id));

          let allFullyDispatched = true;
          let anyDispatched = false;

          for (const oi of allOrderItems) {
            let dispatchedQty = 0;

            // 1. By orderItemId
            const [byItem] = await tx
              .select({ total: sql<number>`sum(${dispatchItems.quantity})`.mapWith(Number) })
              .from(dispatchItems)
              .where(eq(dispatchItems.orderItemId, oi.id));
            
            dispatchedQty = byItem?.total || 0;

            // 2. Or by dispatchId + productId/variantId
            if (!dispatchedQty && dispatchIds.length > 0) {
              const [byOrder] = await tx
                .select({ total: sql<number>`sum(${dispatchItems.quantity})`.mapWith(Number) })
                .from(dispatchItems)
                .where(
                  and(
                    inArray(dispatchItems.dispatchId, dispatchIds),
                    eq(dispatchItems.productId, oi.productId),
                    oi.variantId ? eq(dispatchItems.variantId, oi.variantId) : isNull(dispatchItems.variantId)
                  )
                );
              dispatchedQty = byOrder?.total || 0;
            }

            if (dispatchedQty > 0) {
              anyDispatched = true;
            }
            if (dispatchedQty < oi.baseQuantity) {
              allFullyDispatched = false;
            }
          }

          let nextStatus: string;
          if (newInvoice.status === 'draft') {
            nextStatus = anyDispatched ? 'partially_dispatched' : 'processing';
          } else {
            nextStatus = allFullyDispatched ? 'delivered' : (anyDispatched ? 'partially_dispatched' : 'confirmed');
          }

          await tx
            .update(orders)
            .set({ status: nextStatus, updatedAt: new Date() })
            .where(eq(orders.id, targetOrder.id));
        }
      }

      // 7. Upsert custom party prices
      if (customPricesToUpsert.length > 0) {
        for (const cp of customPricesToUpsert) {
          const conditions = [
            eq(contactCustomPrices.orgId, cp.orgId),
            eq(contactCustomPrices.contactId, cp.contactId),
            eq(contactCustomPrices.productId, cp.productId),
          ];
          if (cp.variantId) {
            conditions.push(eq(contactCustomPrices.variantId, cp.variantId));
          } else {
            conditions.push(sql`${contactCustomPrices.variantId} IS NULL`);
          }

          const [existingCp] = await tx
            .select()
            .from(contactCustomPrices)
            .where(and(...conditions))
            .limit(1);

          if (existingCp) {
            await tx
              .update(contactCustomPrices)
              .set({ customPrice: cp.customPrice, updatedAt: new Date() })
              .where(eq(contactCustomPrices.id, existingCp.id));
          } else {
            await tx.insert(contactCustomPrices).values(cp);
          }
        }
      }
      // 8. Update Global Purchase Rates & History
      if (purchasePricesToUpdate.length > 0) {
        for (const update of purchasePricesToUpdate) {
          const { productOrVariant, isVariant, newCostPrice } = update;
          if (isVariant) {
            await tx
              .update(productVariants)
              .set({  updatedAt: new Date() })
              .where(eq(productVariants.id, productOrVariant.id));
          } else {
            await tx
              .update(products)
              .set({  updatedAt: new Date() })
              .where(eq(products.id, productOrVariant.id));
          }

          await tx.insert(productVariantPriceHistory).values({
            orgId,
            productId: isVariant ? productOrVariant.productId : productOrVariant.id,
            variantId: isVariant ? productOrVariant.id : null,
            
            
            
            mrp: productOrVariant.mrp,
            
            
            
            valuationCost: newCostPrice,
            
            
            
            createdBy,
          });
        }
      }

      await journalService.writeInvoiceJournal(tx, orgId, newInvoice, createdBy || null);

      return newInvoice;
    });

    return this.getInvoiceById(orgId, result.id);
  },

  /**
   * Update an existing invoice.
   */
  async updateInvoice(orgId: string, invoiceId: string, input: UpdateInvoiceInput) {
    const existing = await this.getInvoiceById(orgId, invoiceId);

    // Enforce chronological sequence of invoice dates based on invoice number (supports skipped numbers)
    const finalInvoiceDate = input.invoiceDate || existing.invoiceDate;
    const finalInvoiceNumber = input.invoiceNumber !== undefined ? input.invoiceNumber : existing.invoiceNumber;
    
    if (existing.documentType === 'sales_invoice' && finalInvoiceDate && finalInvoiceNumber) {
      const bounds = await this.getSequenceBounds(orgId, existing.documentType, finalInvoiceNumber);
      if (bounds.prev?.invoiceDate && new Date(finalInvoiceDate) < new Date(bounds.prev.invoiceDate)) {
        throw new ApiError(400, `Invoice date (${finalInvoiceDate}) cannot be earlier than previous invoice (${bounds.prev.invoiceNumber} dated ${bounds.prev.invoiceDate})`);
      }
      if (bounds.next?.invoiceDate && new Date(finalInvoiceDate) > new Date(bounds.next.invoiceDate)) {
        throw new ApiError(400, `Invoice date (${finalInvoiceDate}) cannot be later than next invoice (${bounds.next.invoiceNumber} dated ${bounds.next.invoiceDate})`);
      }
    }

    // Look up supplier stateCode
    const [org] = await db
      .select({ stateCode: organizations.stateCode })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const supplierStateCode = org?.stateCode || '27';
    const buyerStateCode = input.placeOfSupplyCode || existing.placeOfSupplyCode || supplierStateCode;
    const isInterState = input.isInterState !== undefined && input.isInterState !== null
      ? input.isInterState
      : (existing.isInterState !== undefined && existing.isInterState !== null 
          ? existing.isInterState 
          : isInterStateSupply(supplierStateCode, buyerStateCode));

    if (input.contactId && input.contactId !== existing.contactId) {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.id, input.contactId)))
        .limit(1);
      
      if (!contact) {
        throw ApiError.notFound('Recipient contact not found');
      }

      if ((existing.documentType === 'sales_invoice' || existing.documentType === 'credit_note') && contact.type === 'vendor') {
        throw new ApiError(400, 'Cannot use a vendor contact for a sales document');
      }
      if ((existing.documentType === 'purchase_invoice' || existing.documentType === 'debit_note') && contact.type === 'customer') {
        throw new ApiError(400, 'Cannot use a customer contact for a purchase document');
      }
    }

    // If new line items are supplied, we recompute totals
    let updateFields: any = {
      invoiceNumber: input.invoiceNumber !== undefined ? input.invoiceNumber : existing.invoiceNumber,
      invoiceDate: input.invoiceDate || existing.invoiceDate,
      dueDate: input.dueDate || existing.dueDate,
      billingAddressId: input.billingAddressId !== undefined ? input.billingAddressId : existing.billingAddressId,
      shippingAddressId: input.shippingAddressId !== undefined ? input.shippingAddressId : existing.shippingAddressId,
      placeOfSupplyCode: buyerStateCode,
      isInterState,
      reverseCharge: input.reverseCharge !== undefined ? input.reverseCharge : existing.reverseCharge,
      paymentTermId: input.paymentTermId !== undefined ? input.paymentTermId : existing.paymentTermId,
      transporterId: input.transporterId !== undefined ? input.transporterId : existing.transporterId,
      ewayBillNumber: input.ewayBillNumber !== undefined ? input.ewayBillNumber : existing.ewayBillNumber,
      ewayBillDate: input.ewayBillDate !== undefined ? input.ewayBillDate : existing.ewayBillDate,
      transportMode: input.transportMode !== undefined ? input.transportMode : existing.transportMode,
      vehicleNumber: input.vehicleNumber !== undefined ? input.vehicleNumber : existing.vehicleNumber,
      status: input.status || existing.status,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      termsAndConditions: input.termsAndConditions !== undefined ? input.termsAndConditions : existing.termsAndConditions,
      customerNotes: input.customerNotes !== undefined ? input.customerNotes : existing.customerNotes,
      customFields: input.customFields !== undefined ? input.customFields : existing.customFields,
      updatedAt: new Date(),
    };

    let newLines: any[] = [];
    const customPricesToUpsert: any[] = [];
    const purchasePricesToUpdate: any[] = [];

    if (input.lineItems && input.lineItems.length > 0) {
      let subtotal = 0;
      let discountAmount = 0;
      let taxableAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;
      let cessAmount = 0;
      let totalTaxAmount = 0;

      // Fetch products and variants to compare global selling price
      const productIds = input.lineItems.map((li) => li.productId).filter(Boolean) as string[];
      const variantIds = input.lineItems.map((li) => li.variantId).filter(Boolean) as string[];
      const fetchedProducts = productIds.length > 0 ? await db.select().from(products).where(inArray(products.id, productIds)) : [];
      const fetchedVariants = variantIds.length > 0 ? await db.select().from(productVariants).where(inArray(productVariants.id, variantIds)) : [];
      const fetchedPricingRules = productIds.length > 0
        ? await db.select().from(productPricingRules).where(and(inArray(productPricingRules.productId, productIds), isNull(productPricingRules.priceListId)))
        : [];

      for (let i = 0; i < input.lineItems.length; i++) {
        const line = input.lineItems[i];
        const qty = Number(line.quantity !== undefined ? line.quantity : 1);
        const price = Number(line.unitPrice !== undefined ? line.unitPrice : 0);
        const discVal = Number(line.discountValue || 0);

        // Party Rate Setup Tracking
        if (existing.documentType === 'sales_invoice') {
          let globalPrice = 0;
          if (line.variantId) {
            const rule = fetchedPricingRules.find(r => r.productId === line.productId && r.variantId === line.variantId);
            if (rule) globalPrice = Number(rule.listPrice);
          } else if (line.productId) {
            const rule = fetchedPricingRules.find(r => r.productId === line.productId && !r.variantId);
            if (rule) globalPrice = Number(rule.listPrice);
          }

          if (globalPrice > 0 && price !== globalPrice && line.productId) {
            customPricesToUpsert.push({
              orgId,
              contactId: input.contactId || existing.contactId,
              productId: line.productId,
              variantId: line.variantId || null,
              customPrice: price.toFixed(2),
            });
          }
        }

        // Purchase Rate Setup Tracking
        if (existing.documentType === 'purchase_invoice') {
          let globalCost = 0;
          let pOrV: any = null;
          let isVar = false;
          if (line.variantId) {
            const v = fetchedVariants.find((v) => v.id === line.variantId);
            if (v) {
               globalCost = Number(v.valuationCost);
               pOrV = v;
               isVar = true;
            }
          } else if (line.productId) {
            const p = fetchedProducts.find((p) => p.id === line.productId);
            if (p) {
               globalCost = Number(p.valuationCost);
               pOrV = p;
               isVar = false;
            }
          }

          if (price !== globalCost && pOrV) {
            purchasePricesToUpdate.push({
              productOrVariant: pOrV,
              isVariant: isVar,
              newCostPrice: price.toFixed(2),
            });
          }
        }

        // Look up tax rate from database
        let taxRatePercent = 0;
        if (line.taxRateId) {
          const [tr] = await db
            .select({ ratePercentage: taxRates.ratePercentage })
            .from(taxRates)
            .where(and(eq(taxRates.orgId, orgId), eq(taxRates.id, line.taxRateId)))
            .limit(1);
          if (tr) {
            taxRatePercent = Number(tr.ratePercentage);
          }
        }

        const lineTotal = qty * price;
        let lineDiscount = 0;
        if (line.discountType === 'percentage') {
          lineDiscount = (lineTotal * discVal) / 100;
        } else {
          lineDiscount = discVal;
        }

        const gstDetails = calculateLineItemGst(
          price,
          qty,
          lineDiscount,
          taxRatePercent,
          supplierStateCode,
          buyerStateCode,
          0,
          isInterState
        );

        subtotal += lineTotal;
        discountAmount += lineDiscount;
        taxableAmount += gstDetails.taxableValue;
        cgstAmount += gstDetails.cgstAmount;
        sgstAmount += gstDetails.sgstAmount;
        igstAmount += gstDetails.igstAmount;
        cessAmount += gstDetails.cessAmount;
        totalTaxAmount += gstDetails.totalTax;

        newLines.push({
          orgId,
          invoiceId,
          lineNumber: i + 1,
          productId: line.productId || null,
          variantId: line.variantId || null,
          description: line.description,
          hsnCode: line.hsnCode || null,
          quantity: qty.toFixed(2),
          unitPrice: price.toFixed(2),
          discountType: line.discountType || 'percentage',
          discountValue: discVal.toFixed(2),
          discountAmount: lineDiscount.toFixed(2),
          taxableValue: gstDetails.taxableValue.toFixed(2),
          taxRateId: line.taxRateId || null,
          taxRatePercent: taxRatePercent.toFixed(2),
          cgstRate: gstDetails.cgstRate.toFixed(2),
          cgstAmount: gstDetails.cgstAmount.toFixed(2),
          sgstRate: gstDetails.sgstRate.toFixed(2),
          sgstAmount: gstDetails.sgstAmount.toFixed(2),
          igstRate: gstDetails.igstRate.toFixed(2),
          igstAmount: gstDetails.igstAmount.toFixed(2),
          cessRate: gstDetails.cessRate.toFixed(2),
          cessAmount: gstDetails.cessAmount.toFixed(2),
          totalAmount: gstDetails.totalAmount.toFixed(2),
        });
      }

      const round = Number(input.roundOff !== undefined ? input.roundOff : existing.roundOff);
      const finalTotal = taxableAmount + totalTaxAmount + round;

      updateFields = {
        ...updateFields,
        subtotal: subtotal.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        taxableAmount: taxableAmount.toFixed(2),
        cgstAmount: cgstAmount.toFixed(2),
        sgstAmount: sgstAmount.toFixed(2),
        igstAmount: igstAmount.toFixed(2),
        cessAmount: cessAmount.toFixed(2),
        totalTaxAmount: totalTaxAmount.toFixed(2),
        roundOff: round.toFixed(2),
        totalAmount: finalTotal.toFixed(2),
        balanceDue: Math.max(0, finalTotal - Number(existing.amountPaid || 0)).toFixed(2),
      };
    } else if (input.roundOff !== undefined) {
      const round = Number(input.roundOff);
      const finalTotal = Number(existing.taxableAmount) + Number(existing.totalTaxAmount) + round;
      updateFields = {
        ...updateFields,
        roundOff: round.toFixed(2),
        totalAmount: finalTotal.toFixed(2),
        balanceDue: Math.max(0, finalTotal - Number(existing.amountPaid || 0)).toFixed(2),
      };
    }

    // Run transaction
    await db.transaction(async (tx) => {
      // Revert old stock if it was not draft or cancelled
      if (existing.status !== 'draft' && existing.status !== 'cancelled') {
        await adjustInvoiceStock(tx, orgId, existing.documentType, existing.lineItems, true);
      }

      // Update header
      const [updatedHeader] = await tx
        .update(invoices)
        .set(updateFields)
        .where(eq(invoices.id, invoiceId))
        .returning();

      if (newLines.length > 0) {
        // Delete old lines
        await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
        // Insert new lines
        await tx.insert(invoiceLineItems).values(newLines);
      }

      // Apply new stock if the updated status is not draft or cancelled
      const newStatus = updateFields.status || existing.status;
      if (newStatus !== 'draft' && newStatus !== 'cancelled') {
        const linesToApply = newLines.length > 0 ? newLines : existing.lineItems;
        await adjustInvoiceStock(tx, orgId, existing.documentType, linesToApply);
      }

      // Upsert custom party prices
      if (newLines.length > 0 && customPricesToUpsert.length > 0) {
        for (const cp of customPricesToUpsert) {
          const conditions = [
            eq(contactCustomPrices.orgId, cp.orgId),
            eq(contactCustomPrices.contactId, cp.contactId),
            eq(contactCustomPrices.productId, cp.productId),
          ];
          if (cp.variantId) {
            conditions.push(eq(contactCustomPrices.variantId, cp.variantId));
          } else {
            conditions.push(sql`${contactCustomPrices.variantId} IS NULL`);
          }

          const [existingCp] = await tx
            .select()
            .from(contactCustomPrices)
            .where(and(...conditions))
            .limit(1);

          if (existingCp) {
            await tx
              .update(contactCustomPrices)
              .set({ customPrice: cp.customPrice, updatedAt: new Date() })
              .where(eq(contactCustomPrices.id, existingCp.id));
          } else {
            await tx.insert(contactCustomPrices).values(cp);
          }
        }
      }
      // Update Global Purchase Rates & History
      if (newLines.length > 0 && purchasePricesToUpdate.length > 0) {
        for (const update of purchasePricesToUpdate) {
          const { productOrVariant, isVariant, newCostPrice } = update;
          if (isVariant) {
            await tx
              .update(productVariants)
              .set({  updatedAt: new Date() })
              .where(eq(productVariants.id, productOrVariant.id));
          } else {
            await tx
              .update(products)
              .set({  updatedAt: new Date() })
              .where(eq(products.id, productOrVariant.id));
          }

          await tx.insert(productVariantPriceHistory).values({
            orgId,
            productId: isVariant ? productOrVariant.productId : productOrVariant.id,
            variantId: isVariant ? productOrVariant.id : null,
            
            
            
            mrp: productOrVariant.mrp,
            
            
            
            valuationCost: newCostPrice,
            
            
            
            createdBy: null,
          });
        }
      }

      await journalService.writeInvoiceJournal(tx, orgId, updatedHeader, null);
    });

    return this.getInvoiceById(orgId, invoiceId);
  },

  /**
   * Delete / Cancel an invoice.
   */
  /**
   * Delete / Cancel an invoice.
   * - If 'draft': Permanently delete lines and invoice record (clean database).
   * - If issued/sent/approved: Soft-delete (set status = 'cancelled' and deletedAt = now()) to preserve legal audit sequence.
   */
  async deleteInvoice(orgId: string, invoiceId: string) {
    const existing = await this.getInvoiceById(orgId, invoiceId);

    const result = await db.transaction(async (tx) => {
      if (existing.status === 'draft') {
        // 1. Delete lines
        await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));
        // 2. Delete journal entry if any
        await journalService.deleteJournalBySource(tx, orgId, 'invoice', invoiceId);
        // 3. Hard delete draft invoice record
        await tx.delete(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)));
        return { id: invoiceId, status: 'deleted', permanent: true };
      }

      // If already issued or non-draft: Soft delete & cancel
      const [updated] = await tx
        .update(invoices)
        .set({
          status: 'cancelled',
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.orgId, orgId), eq(invoices.id, invoiceId)))
        .returning();

      // Revert stock if it was committed
      if (existing.status !== 'cancelled') {
        await adjustInvoiceStock(tx, orgId, existing.documentType, existing.lineItems, true);
      }

      // Revert/Delete posted accounting journal
      await journalService.deleteJournalBySource(tx, orgId, 'invoice', invoiceId);

      return { ...updated, permanent: false };
    });

    return result;
  },
};
