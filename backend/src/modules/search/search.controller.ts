import { Request, Response } from 'express';
import { db } from '../../config/database.js';
import { contacts } from '../../db/schema/contacts.js';
import { products, productVariants } from '../../db/schema/products.js';
import { invoices, invoiceLineItems } from '../../db/schema/invoices.js';
import { sendSuccess, sendError } from '../../utils/api-response.js';
import { or, ilike, and, eq, exists } from 'drizzle-orm';

export const searchController = {
  globalSearch: async (req: Request, res: Response) => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) {
        return sendError(res, 'Organization ID is required', 400);
      }

      const q = req.query.q as string;
      if (!q || q.length < 2) {
        return sendSuccess(res, { contacts: [], products: [] });
      }

      const terms = q.split(/\s+/).filter(t => t.length > 0);
      if (terms.length === 0) {
        return sendSuccess(res, { contacts: [], products: [], variants: [] });
      }

      // Helper to build ILIKE conditions for multiple terms
      const buildTermConditions = (columns: any[]) => {
        return and(
          ...terms.map(t => {
            const pattern = `%${t}%`;
            return or(...columns.map(col => ilike(col, pattern)));
          })
        );
      };

      // Search contacts
      const matchedContacts = await db
        .select({
          id: contacts.id,
          name: contacts.displayName,
          companyName: contacts.companyName,
          type: contacts.type,
          email: contacts.email,
          phone: contacts.phone,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.orgId, orgId),
            buildTermConditions([contacts.displayName, contacts.companyName, contacts.email, contacts.phone])
          )
        )

      // Search products (including variants)
      const matchedProducts = await db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          type: products.type,
          hasVariants: products.hasVariants,
        })
        .from(products)
        .where(
          and(
            eq(products.orgId, orgId),
            or(
              buildTermConditions([products.name, products.sku]),
              exists(
                db.select().from(productVariants).where(
                  and(
                    eq(productVariants.productId, products.id),
                    buildTermConditions([productVariants.name, productVariants.sku])
                  )
                )
              )
            )
          )
        )

      // Search product variants
      const matchedVariants = await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          name: productVariants.name,
          sku: productVariants.sku,
        })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.orgId, orgId),
            buildTermConditions([productVariants.name, productVariants.sku])
          )
        )

      // Search invoices (by invoice number, contact name/company, or line item description)
      const matchedInvoices = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          documentType: invoices.documentType,
          totalAmount: invoices.totalAmount,
          status: invoices.status,
          contactName: contacts.displayName,
        })
        .from(invoices)
        .leftJoin(contacts, eq(invoices.contactId, contacts.id))
        .where(
          and(
            eq(invoices.orgId, orgId),
            or(
              buildTermConditions([invoices.invoiceNumber, contacts.displayName, contacts.companyName]),
              exists(
                db.select().from(invoiceLineItems).where(
                  and(
                    eq(invoiceLineItems.invoiceId, invoices.id),
                    buildTermConditions([invoiceLineItems.description])
                  )
                )
              )
            )
          )
        );

      sendSuccess(res, {
        contacts: matchedContacts,
        products: matchedProducts,
        variants: matchedVariants,
        invoices: matchedInvoices,
      });
    } catch (error: any) {
      console.error('Global search error:', error);
      sendError(res, 'Failed to perform search', 500, error.message);
    }
  },
};
