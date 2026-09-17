import { db } from '../../db/index.js';
import { priceListItems, priceLists } from '../../db/schema/price-lists.js';
import { promotionalSchemeItems, promotionalSchemes } from '../../db/schema/promotions.js';
import { contactCustomPrices } from '../../db/schema/contact-prices.js';
import { and, eq, lte, gte, isNull, desc, inArray, or, ilike } from 'drizzle-orm';
import { contacts } from '../../db/schema/contacts.js';
import { products, productVariants } from '../../db/schema/products.js';
import { categories, brands } from '../../db/schema/masters.js';

export class PricingService {
  /**
   * Resolves the active price for a specific product/variant and contact.
   * Priority:
   * 1. Contact Custom Prices
   * 2. Promotional Schemes (based on priority field)
   * 3. Price List (Contact assigned -> Global Default)
   */
  static async resolvePrice({
    orgId,
    contactId,
    productId,
    variantId = null,
    quantity = 1,
    type = 'sales' // 'sales' or 'purchase'
  }: {
    orgId: string;
    contactId: string;
    productId: string;
    variantId?: string | null;
    quantity?: number;
    type?: 'sales' | 'purchase';
  }) {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Check Contact Custom Prices (Highest Priority)
    const customPrices = await db.select()
      .from(contactCustomPrices)
      .where(
        and(
          eq(contactCustomPrices.orgId, orgId),
          eq(contactCustomPrices.contactId, contactId),
          eq(contactCustomPrices.productId, productId),
          eq(contactCustomPrices.type, type),
          variantId ? eq(contactCustomPrices.variantId, variantId) : isNull(contactCustomPrices.variantId)
        )
      )
      .limit(1);

    if (customPrices.length > 0) {
      const cp = customPrices[0];
      // Check date validity if set
      const fromValid = !cp.validFrom || cp.validFrom <= today;
      const toValid = !cp.validTo || cp.validTo >= today;
      if (fromValid && toValid) {
        return {
          price: Number(cp.customPrice),
          source: 'contact_custom',
          details: cp
        };
      }
    }

    // 2. Check Promotional Schemes (Sales only for now, though conceptually can apply to purchase)
    let bestPromoPrice = null;
    let appliedPromo = null;

    if (type === 'sales') {
      const activePromos = await db.select({
        scheme: promotionalSchemes,
        item: promotionalSchemeItems
      })
      .from(promotionalSchemes)
      .leftJoin(promotionalSchemeItems, eq(promotionalSchemes.id, promotionalSchemeItems.schemeId))
      .where(
        and(
          eq(promotionalSchemes.orgId, orgId),
          eq(promotionalSchemes.isActive, true),
          lte(promotionalSchemes.validFrom, today),
          gte(promotionalSchemes.validTo, today),
          lte(promotionalSchemes.minQuantity, quantity)
        )
      )
      .orderBy(desc(promotionalSchemes.priority));

      // Filter promos that apply to this product
      // We need the product details (categoryId, brandId)
      const product = await db.query.products.findFirst({
        where: (products, { eq, and }) => and(eq(products.id, productId), eq(products.orgId, orgId))
      });

      for (const row of activePromos) {
        let applies = false;
        if (row.scheme.appliesTo === 'all_products') {
          applies = true;
        } else if (row.scheme.appliesTo === 'specific_brands' && row.item && product?.brandId) {
          if (row.item.brandId === product.brandId) {
            applies = true;
          }
        } else if (row.scheme.appliesTo === 'specific_products' && row.item) {
          if (row.item.productId === productId && (!row.item.variantId || row.item.variantId === variantId)) {
            applies = true;
          }
        } else if (row.scheme.appliesTo === 'specific_variants' && row.item) {
          if (row.item.variantId && row.item.variantId === variantId) {
            applies = true;
          }
        } else if (row.scheme.appliesTo === 'specific_categories' && row.item && product?.categoryId === row.item.categoryId) {
          applies = true;
        }

        if (applies) {
          appliedPromo = row.scheme;
          break; // Since it's ordered by priority desc, first match is highest priority
        }
      }
    }

    // 3. Resolve base price from Price Lists
    let priceListId = null;

    // Check if contact has assigned price list
    const contact = await db.query.contacts.findFirst({
      where: (contacts, { eq, and }) => and(eq(contacts.id, contactId), eq(contacts.orgId, orgId))
    });

    if (type === 'sales' && contact?.salesPriceListId) {
      priceListId = contact.salesPriceListId;
    } else if (type === 'purchase' && contact?.purchasePriceListId) {
      priceListId = contact.purchasePriceListId;
    } else {
      // Fallback to global default for type
      const defaultList = await db.query.priceLists.findFirst({
        where: (pl, { eq, and }) => and(
          eq(pl.orgId, orgId),
          eq(pl.type, type),
          eq(pl.isGlobalDefault, true),
          eq(pl.isActive, true)
        )
      });
      if (defaultList) priceListId = defaultList.id;
    }

    let baseListPrice = 0;
    
    if (priceListId) {
      const listItems = await db.select()
        .from(priceListItems)
        .where(
          and(
            eq(priceListItems.orgId, orgId),
            eq(priceListItems.priceListId, priceListId),
            eq(priceListItems.productId, productId),
            variantId ? eq(priceListItems.variantId, variantId) : isNull(priceListItems.variantId),
            lte(priceListItems.minQuantity, quantity)
          )
        )
        .orderBy(desc(priceListItems.minQuantity))
        .limit(1);

      if (listItems.length > 0) {
        baseListPrice = Number(listItems[0].sellingPrice);
      } else {
        // Fallback to product.valuationCost if purchase list has no item? 
        // We migrate all products, so it should have an item.
        const p = await db.query.products.findFirst({
           where: (products, { eq }) => eq(products.id, productId)
        });
        baseListPrice = Number(p?.valuationCost || 0);
      }
    }

    // Apply Promo if exists
    let finalPrice = baseListPrice;
    if (appliedPromo && type === 'sales') {
      let discountAmt = 0;
      if (appliedPromo.discountType === 'percentage') {
        discountAmt = (baseListPrice * Number(appliedPromo.discountValue)) / 100;
        if (appliedPromo.maxDiscountAmount && discountAmt > Number(appliedPromo.maxDiscountAmount)) {
          discountAmt = Number(appliedPromo.maxDiscountAmount);
        }
      } else {
        // flat amount is per line, but resolvePrice might be used per unit.
        // Usually schemes apply flat amount per unit if configured that way, 
        // or we treat discountValue as per unit. Let's assume per unit for simplicity here.
        discountAmt = Number(appliedPromo.discountValue);
      }
      finalPrice = Math.max(0, baseListPrice - discountAmt);
      
      return {
        price: finalPrice,
        source: 'promotional_scheme',
        baseListPrice,
        discountAmt,
        details: appliedPromo
      };
    }

    return {
      price: finalPrice,
      source: 'price_list',
      details: { priceListId }
    };
  }

  /**
   * Retrieves all products (and their variants) for a specific price list.
   * If a product/variant is not explicitly in the price list, it will have empty prices.
   */
  static async getPriceListItems(orgId: string, priceListId: string, filters: {
    search?: string;
    categoryId?: string;
    brandId?: string;
    page?: string | number;
    limit?: string | number;
  }) {
    const conditions: any[] = [eq(products.orgId, orgId), isNull(products.deletedAt)];

    if (filters.categoryId) {
      conditions.push(
        or(
          eq(products.categoryId, filters.categoryId),
          inArray(
            products.id,
            db.select({ id: productVariants.productId })
              .from(productVariants)
              .where(and(eq(productVariants.categoryId, filters.categoryId), isNull(productVariants.deletedAt)))
          )
        )
      );
    }
    if (filters.brandId) conditions.push(eq(products.brandId, filters.brandId));
    if (filters.search) {
      const p = `%${filters.search}%`;
      conditions.push(or(ilike(products.name, p), ilike(products.sku, p)));
    }

    const productList = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        hasVariants: products.hasVariants,
        status: products.status,
        categoryName: categories.name,
        brandName: brands.name,
        
        // Price list item specific
        itemId: priceListItems.id,
        basePrice: priceListItems.basePrice,
        sellingPrice: priceListItems.sellingPrice,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(
        priceListItems,
        and(
          eq(products.id, priceListItems.productId),
          isNull(priceListItems.variantId),
          eq(priceListItems.priceListId, priceListId)
        )
      )
      .where(and(...conditions))
      .orderBy(products.name);

    const productIds = productList.map(p => p.id);
    let variantsList: any[] = [];
    if (productIds.length > 0) {
      variantsList = await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          name: productVariants.name,
          sku: productVariants.sku,
          isActive: productVariants.isActive,
          
          // Price list item specific
          itemId: priceListItems.id,
          basePrice: priceListItems.basePrice,
          sellingPrice: priceListItems.sellingPrice,
        })
        .from(productVariants)
        .leftJoin(
          priceListItems,
          and(
            eq(productVariants.id, priceListItems.variantId),
            eq(priceListItems.priceListId, priceListId)
          )
        )
        .where(and(eq(productVariants.orgId, orgId), inArray(productVariants.productId, productIds), isNull(productVariants.deletedAt)))
        .orderBy(productVariants.sortOrder);
    }

    const resultData = productList.map(p => ({
      ...p,
      variants: variantsList.filter(v => v.productId === p.id),
    }));

    if (filters.page && filters.limit) {
      const pageNum = Number(filters.page) || 1;
      const limitNum = Number(filters.limit) || 10;
      const sliced = resultData.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      return {
        data: sliced,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: resultData.length,
          totalPages: Math.ceil(resultData.length / limitNum) || 1,
        }
      };
    }

    return {
      data: resultData,
      pagination: { page: 1, limit: resultData.length, total: resultData.length, totalPages: 1 }
    };
  }

  /**
   * Bulk updates items for a specific price list.
   * If an item already exists for a product/variant in this list, updates it.
   * Otherwise, inserts it.
   */
  static async updatePriceListItems(orgId: string, priceListId: string, items: any[]) {
    // We expect items to be an array of:
    // { productId: string, variantId?: string, basePrice: string, sellingPrice: string }
    
    // We can use an upsert with onConflictDoUpdate
    for (const item of items) {
      await db.insert(priceListItems).values({
        orgId,
        priceListId,
        productId: item.productId,
        variantId: item.variantId || null,
        basePrice: String(item.basePrice || 0),
        sellingPrice: String(item.sellingPrice || 0),
        listPrice: String(item.sellingPrice || 0), // Defaulting list price to selling price
        minQuantity: 1
      }).onConflictDoUpdate({
        target: item.variantId 
          ? [priceListItems.priceListId, priceListItems.productId, priceListItems.variantId, priceListItems.minQuantity]
          : [priceListItems.priceListId, priceListItems.productId, priceListItems.minQuantity],
        set: {
          basePrice: String(item.basePrice || 0),
          sellingPrice: String(item.sellingPrice || 0),
          listPrice: String(item.sellingPrice || 0),
          updatedAt: new Date()
        }
      });
    }
  }
}
