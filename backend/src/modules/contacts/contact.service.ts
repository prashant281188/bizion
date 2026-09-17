import { db } from '../../db/index.js';
import { contacts, contactAddresses } from '../../db/schema/contacts.js';
import { paymentTerms, taxRates, contactGroups } from '../../db/schema/masters.js';
import { contactCustomPrices } from '../../db/schema/contact-prices.js';
import { products, productVariants } from '../../db/schema/products.js';
import { orders, orderItems } from '../../db/schema/orders.js';
import { invoices, invoiceLineItems } from '../../db/schema/invoices.js';
import { financialTransactions, journalEntries } from '../../db/schema/accounting.js';
import { payments } from '../../db/schema/payments.js';
import { users } from '../../db/schema/users.js';
import bcrypt from 'bcryptjs';
import { ApiError } from '../../utils/api-error.js';
import { eq, and, isNull, like, or, sql, inArray, notInArray, asc, desc } from 'drizzle-orm';
import type { CreateContactInput, UpdateContactInput, AddressInput } from './contact.schema.js';

export const contactService = {
  /**
   * List all contacts in organization with pagination and filters.
   */
  async listContacts(orgId: string, filters: {
    type?: string;
    status?: string;
    contactGroupId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(contacts.orgId, orgId),
      isNull(contacts.deletedAt),
    ];

    if (filters.status === 'active') {
      conditions.push(eq(contacts.isActive, true));
    } else if (filters.status === 'inactive') {
      conditions.push(eq(contacts.isActive, false));
    }

    if (filters.type && filters.type !== 'all') {
      if (filters.type === 'customer' || filters.type === 'vendor') {
        conditions.push(
          or(
            eq(contacts.type, filters.type as any),
            eq(contacts.type, 'both')
          ) as any
        );
      }
    }

    if (filters.contactGroupId) {
      conditions.push(eq(contacts.contactGroupId, filters.contactGroupId));
    }

    if (filters.search) {
      conditions.push(
        or(
          like(contacts.displayName, `%${filters.search}%`),
          like(contacts.companyName, `%${filters.search}%`),
          like(contacts.email, `%${filters.search}%`),
          like(contacts.phone, `%${filters.search}%`),
          like(contacts.mobile, `%${filters.search}%`)
        ) as any
      );
    }

    const whereClause = and(...conditions);

    // Get count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const balanceQuery = sql<number>`
      COALESCE(${contacts.openingBalance}, 0) + 
      (SELECT COALESCE(SUM(CASE WHEN inv.document_type IN ('sales_invoice', 'debit_note') THEN inv.balance_due WHEN inv.document_type IN ('purchase_invoice', 'credit_note') THEN -inv.balance_due ELSE 0 END), 0) FROM invoices inv WHERE inv.contact_id = ${contacts.id} AND inv.status NOT IN ('paid', 'cancelled', 'draft') AND inv.document_type IN ('sales_invoice', 'purchase_invoice', 'credit_note', 'debit_note'))
    `;

    // Fetch contacts
    const rawData = await db
      .select({
        contact: contacts,
        groupName: contactGroups.name,
        balance: sql<number>`${balanceQuery}`.as('balance'),
        portalUser: {
          id: users.id,
          email: users.email,
          phone: users.phone,
          status: users.status,
        },
      })
      .from(contacts)
      .leftJoin(contactGroups, eq(contacts.contactGroupId, contactGroups.id))
      .leftJoin(users, eq(contacts.id, users.contactId))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        desc(contacts.isActive),
        (() => {
          const sortBy = filters.sortBy || 'displayName';
          const sortOrder = filters.sortOrder || 'asc';
          const orderFn = sortOrder === 'desc' ? desc : asc;
          if (sortBy === 'companyName') return orderFn(contacts.companyName);
          if (sortBy === 'email') return orderFn(contacts.email);
          if (sortBy === 'mobile') return orderFn(contacts.mobile);
          if (sortBy === 'createdAt') return orderFn(contacts.createdAt);
          if (sortBy === 'balance') return orderFn(sql`${balanceQuery}`);
          return orderFn(contacts.displayName);
        })()
      );

    const data = rawData.map(row => ({
      ...row.contact,
      balance: row.balance,
      groupName: row.groupName,
      hasPortalAccess: !!row.portalUser?.id,
      portalUserId: row.portalUser?.email?.includes('@no-email.bizion.com') ? row.portalUser?.phone : (row.portalUser?.email || row.portalUser?.phone),
    }));

    const contactIds = data.map(c => c.id);
    let allAddresses: any[] = [];
    if (contactIds.length > 0) {
      allAddresses = await db
        .select()
        .from(contactAddresses)
        .where(
          and(
            eq(contactAddresses.orgId, orgId),
            inArray(contactAddresses.contactId, contactIds),
            isNull(contactAddresses.deletedAt)
          )
        );
    }

    const dataWithAddresses = data.map(contact => ({
      ...contact,
      addresses: allAddresses.filter(addr => addr.contactId === contact.id),
    }));

    return {
      data: dataWithAddresses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  /**
   * Get contact by ID along with their addresses.
   */
  async getContactById(orgId: string, id: string) {
    const [result] = await db
      .select({
        contact: contacts,
        groupName: contactGroups.name,
        balance: sql<number>`
          COALESCE(${contacts.openingBalance}, 0) + 
          (SELECT COALESCE(SUM(CASE WHEN inv.document_type IN ('sales_invoice', 'debit_note') THEN inv.balance_due WHEN inv.document_type IN ('purchase_invoice', 'credit_note') THEN -inv.balance_due ELSE 0 END), 0) FROM invoices inv WHERE inv.contact_id = ${contacts.id} AND inv.status NOT IN ('paid', 'cancelled', 'draft') AND inv.document_type IN ('sales_invoice', 'purchase_invoice', 'credit_note', 'debit_note'))
        `.as('balance'),
      })
      .from(contacts)
      .leftJoin(contactGroups, eq(contacts.contactGroupId, contactGroups.id))
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id), isNull(contacts.deletedAt)))
      .limit(1);

    if (!result) {
      throw ApiError.notFound('Contact not found');
    }

    const { contact, groupName } = result;

    // Fetch addresses
    const addresses = await db
      .select()
      .from(contactAddresses)
      .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.contactId, id), isNull(contactAddresses.deletedAt)));

    return {
      ...result.contact,
      balance: result.balance,
      groupName: result.groupName,
      addresses,
    };
  },

  /**
   * Create contact and addresses in transaction.
   */
  async createContact(orgId: string, userId: string, input: CreateContactInput) {
    const { addresses, ...contactFields } = input;

    // Convert values
    const creditLimit = Number(contactFields.creditLimit || 0).toFixed(2);
    const openingBalance = Number(contactFields.openingBalance || 0).toFixed(2);

    return await db.transaction(async (tx) => {
      // 1. Insert contact
      const [contact] = await tx
        .insert(contacts)
        .values({
          orgId,
          type: contactFields.type as any,
          companyName: contactFields.companyName || null,
          displayName: contactFields.displayName,
          contactPerson: contactFields.contactPerson || null,
          gstin: contactFields.gstin || null,
          gstRegistrationType: contactFields.gstRegistrationType as any,
          pan: contactFields.pan || null,
          email: contactFields.email || null,
          phone: contactFields.phone || null,
          mobile: contactFields.mobile || null,
          website: contactFields.website || null,
          paymentTermId: contactFields.paymentTermId || null,
          defaultTaxRateId: contactFields.defaultTaxRateId || null,
          creditLimit,
          openingBalance,
          contactGroupId: contactFields.contactGroupId || null,
          contactGroup: contactFields.contactGroup || null,
          tags: contactFields.tags || [],
          notes: contactFields.notes || null,
          createdBy: userId,
        })
        .returning();

      // 2. Insert addresses if provided
      const insertedAddresses: any[] = [];
      if (addresses && addresses.length > 0) {
        for (const addr of addresses) {
          const [address] = await tx
            .insert(contactAddresses)
            .values({
              orgId,
              contactId: contact.id,
              label: addr.label || 'Main',
              addressLine1: addr.addressLine1,
              addressLine2: addr.addressLine2 || null,
              city: addr.city,
              stateCode: addr.stateCode.toUpperCase(),
              stateName: addr.stateName,
              pincode: addr.pincode,
              country: addr.country || 'India',
              isBillingDefault: addr.isBillingDefault ?? false,
              isShippingDefault: addr.isShippingDefault ?? false,
            })
            .returning();
          insertedAddresses.push(address);
        }
      }

      return {
        ...contact,
        addresses: insertedAddresses,
      };
    });
  },

  /**
   * Create multiple contacts in transaction.
   */
  async createBulkContacts(orgId: string, userId: string, inputs: CreateContactInput[]) {
    return await db.transaction(async (tx) => {
      const createdContacts = [];

      for (const input of inputs) {
        const { addresses, ...contactFields } = input;

        // Convert values
        const creditLimit = Number(contactFields.creditLimit || 0).toFixed(2);
        const openingBalance = Number(contactFields.openingBalance || 0).toFixed(2);

        // 1. Insert contact
        const [contact] = await tx
          .insert(contacts)
          .values({
            orgId,
            type: contactFields.type as any,
            companyName: contactFields.companyName || null,
            displayName: contactFields.displayName,
            contactPerson: contactFields.contactPerson || null,
            gstin: contactFields.gstin || null,
            gstRegistrationType: contactFields.gstRegistrationType as any,
            pan: contactFields.pan || null,
            email: contactFields.email || null,
            phone: contactFields.phone || null,
            mobile: contactFields.mobile || null,
            website: contactFields.website || null,
            paymentTermId: contactFields.paymentTermId || null,
            defaultTaxRateId: contactFields.defaultTaxRateId || null,
            creditLimit,
            openingBalance,
            contactGroupId: contactFields.contactGroupId || null,
            contactGroup: contactFields.contactGroup || null,
            tags: contactFields.tags || [],
            notes: contactFields.notes || null,
            createdBy: userId,
          })
          .returning();

        // 2. Insert addresses if provided
        const insertedAddresses: any[] = [];
        if (addresses && addresses.length > 0) {
          for (const addr of addresses) {
            const [address] = await tx
              .insert(contactAddresses)
              .values({
                orgId,
                contactId: contact.id,
                label: addr.label || 'Main',
                addressLine1: addr.addressLine1,
                addressLine2: addr.addressLine2 || null,
                city: addr.city,
                stateCode: addr.stateCode.toUpperCase(),
                stateName: addr.stateName,
                pincode: addr.pincode,
                country: addr.country || 'India',
                isBillingDefault: addr.isBillingDefault ?? false,
                isShippingDefault: addr.isShippingDefault ?? false,
              })
              .returning();
            insertedAddresses.push(address);
          }
        }

        createdContacts.push({ ...contact, addresses: insertedAddresses });
      }

      return createdContacts;
    });
  },

  /**
   * Update contact details.
   */
  async updateContact(orgId: string, id: string, input: UpdateContactInput) {
    // Check contact existence
    const contactDetail = await this.getContactById(orgId, id);

    const { addresses, ...contactFields } = input;

    let updateData: any = { ...contactFields, updatedAt: new Date() };
    if (contactFields.creditLimit !== undefined) updateData.creditLimit = Number(contactFields.creditLimit).toFixed(2);
    if (contactFields.openingBalance !== undefined) updateData.openingBalance = Number(contactFields.openingBalance).toFixed(2);

    return await db.transaction(async (tx) => {
      // 1. Update contact
      const [updatedContact] = await tx
        .update(contacts)
        .set(updateData)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)))
        .returning();

      // 2. Sync addresses if provided
      if (addresses !== undefined) {
        const existingAddresses = contactDetail.addresses || [];
        const incomingIds = addresses.map((a: any) => a.id).filter(Boolean);

        // Delete addresses that are missing in the incoming list
        const toDelete = existingAddresses.filter((ea) => !incomingIds.includes(ea.id));
        for (const ea of toDelete) {
          await tx
            .update(contactAddresses)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.id, ea.id)));
        }

        // Insert or update incoming addresses
        for (const addr of addresses) {
          if (addr.id) {
            // Update existing address
            await tx
              .update(contactAddresses)
              .set({
                label: addr.label || 'Main',
                addressLine1: addr.addressLine1,
                addressLine2: addr.addressLine2 || null,
                city: addr.city,
                stateCode: addr.stateCode.toUpperCase(),
                stateName: addr.stateName,
                pincode: addr.pincode,
                country: addr.country || 'India',
                isBillingDefault: !!addr.isBillingDefault,
                isShippingDefault: !!addr.isShippingDefault,
                updatedAt: new Date(),
              })
              .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.id, addr.id)));
          } else {
            // Insert new address
            await tx
              .insert(contactAddresses)
              .values({
                orgId,
                contactId: id,
                label: addr.label || 'Main',
                addressLine1: addr.addressLine1,
                addressLine2: addr.addressLine2 || null,
                city: addr.city,
                stateCode: addr.stateCode.toUpperCase(),
                stateName: addr.stateName,
                pincode: addr.pincode,
                country: addr.country || 'India',
                isBillingDefault: !!addr.isBillingDefault,
                isShippingDefault: !!addr.isShippingDefault,
              });
          }
        }
      }

      // Retrieve final addresses
      const finalAddresses = await tx
        .select()
        .from(contactAddresses)
        .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.contactId, id), isNull(contactAddresses.deletedAt)));

      return {
        ...updatedContact,
        addresses: finalAddresses,
      };
    });
  },

  /**
   * Toggle contact active status (Deactivate / Activate).
   */
  async toggleStatus(orgId: string, id: string, isActive?: boolean) {
    const contact = await this.getContactById(orgId, id);
    const newStatus = isActive !== undefined ? isActive : !contact.isActive;

    const [updatedContact] = await db
      .update(contacts)
      .set({ isActive: newStatus, updatedAt: new Date() })
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)))
      .returning();

    return updatedContact;
  },

  /**
   * Soft-delete contact and its addresses.
   */
  async deleteContact(orgId: string, id: string) {
    await this.getContactById(orgId, id);

    await db.transaction(async (tx) => {
      // Soft-delete contact
      await tx
        .update(contacts)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(contacts.orgId, orgId), eq(contacts.id, id)));

      // Soft-delete its addresses
      await tx
        .update(contactAddresses)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.contactId, id)));
    });
  },

  // ─── Addresses Sub-CRUD ────────────────────────────────────────────────────
  
  async addAddress(orgId: string, contactId: string, input: AddressInput) {
    // Check contact existence
    await this.getContactById(orgId, contactId);

    return await db.transaction(async (tx) => {
      if (input.isBillingDefault) {
        // Clear billing default for this contact's other addresses
        await tx
          .update(contactAddresses)
          .set({ isBillingDefault: false, updatedAt: new Date() })
          .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.contactId, contactId), eq(contactAddresses.isBillingDefault, true)));
      }

      if (input.isShippingDefault) {
        // Clear shipping default for this contact's other addresses
        await tx
          .update(contactAddresses)
          .set({ isShippingDefault: false, updatedAt: new Date() })
          .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.contactId, contactId), eq(contactAddresses.isShippingDefault, true)));
      }

      const [address] = await tx
        .insert(contactAddresses)
        .values({
          orgId,
          contactId,
          label: input.label || 'Main',
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 || null,
          city: input.city,
          stateCode: input.stateCode.toUpperCase(),
          stateName: input.stateName,
          pincode: input.pincode,
          country: input.country || 'India',
          isBillingDefault: input.isBillingDefault ?? false,
          isShippingDefault: input.isShippingDefault ?? false,
        })
        .returning();

      return address;
    });
  },

  async updateAddress(orgId: string, contactId: string, addressId: string, input: any) {
    // Check contact existence
    await this.getContactById(orgId, contactId);

    // Check address existence
    const [existingAddress] = await db
      .select()
      .from(contactAddresses)
      .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.id, addressId), eq(contactAddresses.contactId, contactId), isNull(contactAddresses.deletedAt)))
      .limit(1);

    if (!existingAddress) {
      throw ApiError.notFound('Address not found');
    }

    return await db.transaction(async (tx) => {
      if (input.isBillingDefault) {
        await tx
          .update(contactAddresses)
          .set({ isBillingDefault: false, updatedAt: new Date() })
          .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.contactId, contactId), eq(contactAddresses.isBillingDefault, true)));
      }

      if (input.isShippingDefault) {
        await tx
          .update(contactAddresses)
          .set({ isShippingDefault: false, updatedAt: new Date() })
          .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.contactId, contactId), eq(contactAddresses.isShippingDefault, true)));
      }

      const [updatedAddress] = await tx
        .update(contactAddresses)
        .set({
          ...input,
          stateCode: input.stateCode ? input.stateCode.toUpperCase() : undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.id, addressId)))
        .returning();

      return updatedAddress;
    });
  },

  async deleteAddress(orgId: string, contactId: string, addressId: string) {
    // Check contact existence
    await this.getContactById(orgId, contactId);

    // Check address existence
    const [existingAddress] = await db
      .select()
      .from(contactAddresses)
      .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.id, addressId), eq(contactAddresses.contactId, contactId), isNull(contactAddresses.deletedAt)))
      .limit(1);

    if (!existingAddress) {
      throw ApiError.notFound('Address not found');
    }

    await db
      .update(contactAddresses)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(contactAddresses.orgId, orgId), eq(contactAddresses.id, addressId)));
  },

  // ─── Custom Pricing Sub-CRUD ──────────────────────────────────────────────

  async listCustomPrices(
    orgId: string,
    contactId: string,
    filters: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(contactCustomPrices.orgId, orgId),
      eq(contactCustomPrices.contactId, contactId),
    ];
    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactCustomPrices)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const data = await db
      .select({
        id: contactCustomPrices.id,
        productId: contactCustomPrices.productId,
        variantId: contactCustomPrices.variantId,
        customPrice: contactCustomPrices.customPrice,
        createdAt: contactCustomPrices.createdAt,
        updatedAt: contactCustomPrices.updatedAt,
        productName: products.name,
        productSku: products.sku,
        productSellingPrice: products.valuationCost,
        productCostPrice: products.valuationCost,
        variantName: productVariants.name,
        variantSku: productVariants.sku,
        variantSellingPrice: productVariants.valuationCost,
        variantCostPrice: productVariants.valuationCost,
      })
      .from(contactCustomPrices)
      .innerJoin(products, eq(contactCustomPrices.productId, products.id))
      .leftJoin(productVariants, eq(contactCustomPrices.variantId, productVariants.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        (() => {
          const orderFn = filters.sortOrder === 'asc' ? asc : desc;
          if (filters.sortBy === 'productName') return orderFn(products.name);
          if (filters.sortBy === 'customPrice') return orderFn(contactCustomPrices.customPrice);
          if (filters.sortBy === 'createdAt') return orderFn(contactCustomPrices.createdAt);
          return orderFn(contactCustomPrices.createdAt);
        })()
      );

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  async setCustomPrice(
    orgId: string,
    contactId: string,
    input: { productId: string; variantId?: string | null; customPrice: number | string }
  ) {
    const { productId, variantId, customPrice } = input;
    const priceVal = Number(customPrice).toFixed(2);

    const conditions = [
      eq(contactCustomPrices.orgId, orgId),
      eq(contactCustomPrices.contactId, contactId),
      eq(contactCustomPrices.productId, productId),
    ];
    if (variantId) {
      conditions.push(eq(contactCustomPrices.variantId, variantId));
    } else {
      conditions.push(isNull(contactCustomPrices.variantId));
    }

    const [existing] = await db
      .select()
      .from(contactCustomPrices)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(contactCustomPrices)
        .set({
          customPrice: priceVal,
          updatedAt: new Date(),
        })
        .where(eq(contactCustomPrices.id, existing.id))
        .returning();
      return updated;
    } else {
      const [inserted] = await db
        .insert(contactCustomPrices)
        .values({
          orgId,
          contactId,
          productId,
          variantId: variantId || null,
          customPrice: priceVal,
        })
        .returning();
      return inserted;
    }
  },

  async deleteCustomPrice(orgId: string, contactId: string, priceId: string) {
    const [existing] = await db
      .select()
      .from(contactCustomPrices)
      .where(
        and(
          eq(contactCustomPrices.orgId, orgId),
          eq(contactCustomPrices.contactId, contactId),
          eq(contactCustomPrices.id, priceId)
        )
      )
      .limit(1);

    if (!existing) {
      throw ApiError.notFound('Custom price rule not found');
    }

    await db
      .delete(contactCustomPrices)
      .where(eq(contactCustomPrices.id, priceId));
  },

  /**
   * Get comprehensive customer analytics
   */
  async getContactAnalytics(orgId: string, contactId: string) {
    const [contact] = await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)));
    if (!contact) throw ApiError.notFound('Contact not found');

    // Fetch invoices
    const contactInvoices = await db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.contactId, contactId))).orderBy(desc(invoices.createdAt)).limit(10);
    
    // Fetch orders
    const contactOrders = await db.select().from(orders).where(and(eq(orders.orgId, orgId), eq(orders.contactId, contactId))).orderBy(desc(orders.createdAt)).limit(10);

    // Fetch payments
    const contactPayments = await db.select().from(payments).where(and(eq(payments.orgId, orgId), eq(payments.contactId, contactId))).orderBy(desc(payments.paymentDate)).limit(20);

    // Fetch ledger entries dynamically
    const customerInvoices = await db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.contactId, contactId), inArray(invoices.documentType, ['sales_invoice', 'purchase_invoice', 'credit_note', 'debit_note']), notInArray(invoices.status, ['draft', 'void', 'cancelled'])));
    const customerPayments = await db.select().from(payments).where(and(eq(payments.orgId, orgId), eq(payments.contactId, contactId), notInArray(payments.status, ['cancelled', 'failed'])));

    const ledger: any[] = [];
    
    customerInvoices.forEach(inv => {
      if (inv.status === 'draft' || inv.status === 'void') return;
      let entryType = 'debit';
      let description = 'Invoice';
      if (inv.documentType === 'sales_invoice') {
        entryType = 'debit';
        description = 'Sales Invoice';
      } else if (inv.documentType === 'purchase_invoice') {
        entryType = 'credit';
        description = 'Purchase Invoice';
      } else if (inv.documentType === 'credit_note') {
        entryType = 'credit';
        description = 'Credit Note';
      } else if (inv.documentType === 'debit_note') {
        entryType = 'debit';
        description = 'Debit Note';
      }
      ledger.push({
        id: inv.id,
        date: inv.invoiceDate,
        description,
        transactionNumber: inv.invoiceNumber,
        entryType,
        amount: inv.totalAmount,
        status: inv.status
      });
    });

    customerPayments.forEach(pay => {
      if (pay.status === 'cancelled' || pay.status === 'failed') return;
      let entryType = 'credit';
      if (pay.direction === 'inbound') {
        entryType = 'credit';
      } else if (pay.direction === 'outbound') {
        entryType = 'debit';
      }
      ledger.push({
        id: pay.id,
        date: pay.paymentDate,
        description: pay.direction === 'inbound' ? 'Payment Received' : 'Payment Made',
        transactionNumber: pay.paymentNumber,
        entryType,
        amount: pay.amount,
        status: pay.status
      });
    });

    ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = Number(contact.openingBalance || 0);
    const formattedLedger = ledger.map(entry => {
      const amount = Number(entry.amount);
      if (entry.entryType === 'debit') {
        runningBalance += amount;
      } else {
        runningBalance -= amount;
      }
      return {
        ...entry,
        runningBalance
      };
    });

    // Calculate Insights
    const allInvoices = await db.select({ totalAmount: invoices.totalAmount, balanceDue: invoices.balanceDue, documentType: invoices.documentType }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.contactId, contactId), inArray(invoices.documentType, ['sales_invoice', 'purchase_invoice', 'credit_note', 'debit_note'])));
    
    let totalBilled = 0;
    let totalPaid = 0;
    let balanceDue = 0;
    allInvoices.forEach(inv => {
      const sign = (inv.documentType === 'sales_invoice' || inv.documentType === 'debit_note') ? 1 : -1;
      totalBilled += Number(inv.totalAmount) * sign;
      totalPaid += (Number(inv.totalAmount) - Number(inv.balanceDue)) * sign;
      balanceDue += Number(inv.balanceDue) * sign;
    });

    const avgOrderValue = allInvoices.length > 0 ? (totalBilled / allInvoices.length) : 0;

    // Fetch Product History
    const productHistory = await db.select({
      id: invoiceLineItems.id,
      productName: products.name,
      variantName: productVariants.name,
      date: invoices.invoiceDate,
      quantity: invoiceLineItems.quantity,
      rate: invoiceLineItems.unitPrice,
      total: invoiceLineItems.totalAmount
    })
    .from(invoiceLineItems)
    .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
    .innerJoin(products, eq(invoiceLineItems.productId, products.id))
    .leftJoin(productVariants, eq(invoiceLineItems.variantId, productVariants.id))
    .where(and(eq(invoices.orgId, orgId), eq(invoices.contactId, contactId), inArray(invoices.documentType, ['sales_invoice', 'purchase_invoice'])))
    .orderBy(desc(invoices.invoiceDate))
    .limit(100);

    return {
      contact,
      insights: {
        totalBilled,
        totalPaid,
        balanceDue: runningBalance,
        avgOrderValue,
        totalInvoices: allInvoices.length
      },
      invoices: contactInvoices,
      orders: contactOrders,
      payments: contactPayments,
      ledger: formattedLedger,
      productHistory
    };
  },

  /**
   * Get contact portal access details.
   */
  async getContactAccess(orgId: string, contactId: string) {
    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)),
    });
    if (!contact) throw ApiError.notFound('Contact not found');

    const user = await db.query.users.findFirst({
      where: and(eq(users.contactId, contactId), eq(users.orgId, orgId)),
    });

    if (!user) {
      return {
        hasAccess: false,
        email: contact.email || '',
        phone: contact.phone || contact.mobile || '',
      };
    }

    return {
      hasAccess: user.status === 'active',
      email: user.email.includes('@no-email.bizion.com') ? '' : user.email,
      phone: user.phone || '',
      userId: user.id,
      status: user.status,
    };
  },

  /**
   * Create or update portal access for a contact.
   */
  async manageContactAccess(orgId: string, contactId: string, data: any) {
    const { action, password } = data; // action: 'enable', 'disable', 'update_password'

    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, contactId), eq(contacts.orgId, orgId)),
    });
    if (!contact) throw ApiError.notFound('Contact not found');

    let user = await db.query.users.findFirst({
      where: and(eq(users.contactId, contactId), eq(users.orgId, orgId)),
    });

    if (action === 'disable') {
      if (!user) throw ApiError.badRequest('Contact does not have portal access');
      await db.update(users).set({ status: 'suspended', updatedAt: new Date() }).where(eq(users.id, user.id));
      return { message: 'Access disabled' };
    }

    if (action === 'update_password') {
      if (!user) throw ApiError.badRequest('Contact does not have portal access');
      if (!password || password.length < 6) throw ApiError.badRequest('Password must be at least 6 characters');
      const passwordHash = await bcrypt.hash(password, 10);
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
      return { message: 'Password updated' };
    }

    if (action === 'enable') {
      if (!password || password.length < 6) throw ApiError.badRequest('Password must be at least 6 characters');
      const phone = contact.phone || contact.mobile || '';
      const rawEmail = contact.email || '';
      
      if (!phone && !rawEmail) {
        throw ApiError.badRequest('Contact must have either an email or a phone number to enable portal access.');
      }

      const email = rawEmail || `${phone}@no-email.bizion.com`;

      if (user) {
        // User exists but might be suspended
        const passwordHash = await bcrypt.hash(password, 10);
        await db.update(users).set({
          status: 'active',
          passwordHash,
          email,
          phone,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));
        return { message: 'Access enabled and updated' };
      }

      // Create new user
      const passwordHash = await bcrypt.hash(password, 10);
      await db.insert(users).values({
        orgId,
        contactId,
        email,
        phone,
        passwordHash,
        firstName: contact.displayName,
        lastName: null,
        role: 'customer',
        status: 'active',
      });

      return { message: 'Access enabled' };
    }

    throw ApiError.badRequest('Invalid action');
  }
};
