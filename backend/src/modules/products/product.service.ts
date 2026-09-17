import { db } from '../../db/index.js';
import { products, productVariants, productImages, productVariantPriceHistory, productPricingRules } from '../../db/schema/products.js';
import { categories, brands, unitsOfMeasurement, taxRates, hsnCodes } from '../../db/schema/masters.js';
import { organizations } from '../../db/schema/organizations.js';
import { users } from '../../db/schema/users.js';
import { inventory, warehouses, inventoryTransactions } from '../../db/schema/inventory.js';
import { invoices, invoiceLineItems } from '../../db/schema/invoices.js';
import { orders } from '../../db/schema/orders.js';
import { contacts } from '../../db/schema/contacts.js';
import { ApiError } from '../../utils/api-error.js';
import { eq, and, isNull, like, or, sql, inArray, desc, asc, ilike } from 'drizzle-orm';
import { slugify } from '../../utils/slugify.js';
import type { CreateProductInput, UpdateProductInput, VariantInput } from './product.schema.js';
import { getS3PublicUrl, extractS3Key } from '../../config/s3.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

function generateVariantSku(productName: string, attributes: any): string {
  const sortedKeys = Object.keys(attributes || {}).sort();
  const vals = sortedKeys.map(k => String(attributes[k]).trim()).filter(Boolean);
  const cleanName = productName.trim().replace(/\s+/g, '-');
  const cleanVals = vals.map(v => v.replace(/\s+/g, '-'));
  return [cleanName, ...cleanVals]
    .join('-')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .toUpperCase();
}

export const productService = {

  /**
   * Get recently revised purchase prices to update selling prices.
   */
  async getPriceRevisions(orgId: string) {
    const history = await db.select({
      id: productVariantPriceHistory.id,
      productId: productVariantPriceHistory.productId,
      variantId: productVariantPriceHistory.variantId,
      oldCostPrice: sql<number>`LAG(${productVariantPriceHistory.valuationCost}) OVER (PARTITION BY ${productVariantPriceHistory.productId}, ${productVariantPriceHistory.variantId} ORDER BY ${productVariantPriceHistory.createdAt} ASC)`,
      newCostPrice: productVariantPriceHistory.valuationCost,
      
      createdAt: productVariantPriceHistory.createdAt,
      productName: products.name,
      variantName: productVariants.name,
    })
    .from(productVariantPriceHistory)
    .leftJoin(products, eq(productVariantPriceHistory.productId, products.id))
    .leftJoin(productVariants, eq(productVariantPriceHistory.variantId, productVariants.id))
    .where(eq(productVariantPriceHistory.orgId, orgId))
    .orderBy(desc(productVariantPriceHistory.createdAt));

    // Filter down to where valuationCost changed
    const changes = history.filter(h => h.oldCostPrice !== null && Number(h.oldCostPrice) !== Number(h.newCostPrice));
    
    // De-duplicate to show only the latest change per product/variant
    const uniqueChanges = [];
    const seen = new Set();
    for (const c of changes) {
      const key = `${c.productId}-${c.variantId || 'null'}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueChanges.push(c);
      }
    }

    return uniqueChanges;
  },

  /**
   * List all products in the organization with pagination and filters.
   */
  async listProducts(orgId: string, filters: {
    categoryId?: string;
    brandId?: string;
    status?: string;
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    flattenVariants?: boolean;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    
    // If we need to flatten variants, we must fetch a larger pool from the DB,
    // flatten them in memory, and then paginate the flattened array.
    const dbLimit = filters.flattenVariants ? 5000 : limit;
    const dbOffset = filters.flattenVariants ? 0 : (page - 1) * limit;

    // Build conditions
    const conditions: any[] = [
      eq(products.orgId, orgId),
      isNull(products.deletedAt)
    ];

    if (filters.categoryId) {
      const descendantIds = await this.getDescendantCategoryIds(orgId, filters.categoryId);
      const categoryIds = [filters.categoryId, ...descendantIds];
      conditions.push(
        or(
          inArray(products.categoryId, categoryIds),
          inArray(
            products.id,
            db.select({ id: productVariants.productId })
              .from(productVariants)
              .where(
                and(
                  inArray(productVariants.categoryId, categoryIds),
                  isNull(productVariants.deletedAt)
                )
              )
          )
        )
      );
    }
    if (filters.brandId) {
      conditions.push(eq(products.brandId, filters.brandId));
    }
    if (filters.status) {
      conditions.push(eq(products.status, filters.status as any));
    }
    if (filters.type) {
      conditions.push(eq(products.type, filters.type as any));
    }

    const rawFilters = filters as any;
    if (rawFilters.attributes && typeof rawFilters.attributes === 'object') {
      for (const [key, val] of Object.entries(rawFilters.attributes)) {
        if (!val) continue;
        const pattern = `%${val}%`;
        conditions.push(
          or(
            sql`${products.attributes}->>${key} ILIKE ${pattern}`,
            sql`exists (
              select 1 from product_variants
              where product_variants.product_id = ${products.id}
                and product_variants.attributes->>${key} ILIKE ${pattern}
                and product_variants.deleted_at is null
            )`
          )
        );
      }
    }

    if (filters.search) {
      const searchTerms = filters.search.trim().split(/\s+/).filter(Boolean);
      
      if (searchTerms.length > 0) {
        const termConditions = searchTerms.map((term) => {
          const termPattern = `%${term}%`;
          return or(
            ilike(products.name, termPattern),
            ilike(products.sku, termPattern),
            ilike(products.barcode, termPattern),
            sql`exists (
              select 1 from ${productVariants}
              where ${productVariants.productId} = ${products.id}
                and ${productVariants.deletedAt} is null
                and (${productVariants.sku} ilike ${termPattern} 
                     or ${productVariants.name} ilike ${termPattern} 
                     or ${productVariants.barcode} ilike ${termPattern})
            )`
          );
        });
        
        conditions.push(and(...termConditions) as any);
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Fetch products with joined category, brand, and UOM
    const data = await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        description: products.description,
        shortDescription: products.shortDescription,
        type: products.type,
        sku: products.sku,
        barcode: products.barcode,
        valuationCost: products.valuationCost,
        mrp: products.mrp,
        purchaseMode: productPricingRules.purchaseMode,
        marginPct: productPricingRules.marginPct,
        discountPct: productPricingRules.discountPct,
        salesDiscountPct: productPricingRules.salesDiscountPct,
        listPrice: productPricingRules.listPrice,
        preferredSupplierId: products.preferredSupplierId,
        hasVariants: products.hasVariants,
        trackInventory: products.trackInventory,
        boxQuantity: products.boxQuantity,
        status: products.status,
        categoryId: products.categoryId,
        brandId: products.brandId,
        categoryName: categories.name,
        brandName: brands.name,
        uomCode: unitsOfMeasurement.code,
        hsnCode: hsnCodes.code,
        hsnDescription: hsnCodes.description,
        taxRateId: products.taxRateId,
        hsnCodeId: products.hsnCodeId,
        attributes: products.attributes,
        createdAt: products.createdAt,
        stockQuantity: sql<number>`COALESCE((
          SELECT SUM(quantity_on_hand)
          FROM inventory
          WHERE inventory.product_id = products.id
        ), 0)::int`,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(unitsOfMeasurement, eq(products.uomId, unitsOfMeasurement.id))
      .leftJoin(hsnCodes, eq(products.hsnCodeId, hsnCodes.id))
      .leftJoin(productPricingRules, and(eq(products.id, productPricingRules.productId), isNull(productPricingRules.variantId), isNull(productPricingRules.priceListId)))
      .where(whereClause)
      .limit(dbLimit)
      .offset(dbOffset)
      .orderBy(
        (() => {
          const sortBy = filters.sortBy || 'name';
          const sortOrder = filters.sortOrder || 'asc';
          const orderFn = sortOrder === 'desc' ? desc : asc;
          if (sortBy === 'sku') return orderFn(products.sku);
          if (sortBy === 'valuationCost') return orderFn(products.valuationCost);
          if (sortBy === 'createdAt') return orderFn(products.createdAt);
          return orderFn(products.name);
        })()
      );

    const productIds = data.map((p) => p.id);
    let variantsList: any[] = [];
    let imagesList: any[] = [];

    if (productIds.length > 0) {
      variantsList = await db
        .select({
          id: productVariants.id,
          orgId: productVariants.orgId,
          productId: productVariants.productId,
          sku: productVariants.sku,
          barcode: productVariants.barcode,
          name: productVariants.name,
          categoryId: productVariants.categoryId,
          categoryName: categories.name,
          attributes: productVariants.attributes,
          valuationCost: productVariants.valuationCost,
          mrp: productVariants.mrp,
          purchaseMode: productPricingRules.purchaseMode,
          marginPct: productPricingRules.marginPct,
          discountPct: productPricingRules.discountPct,
          salesDiscountPct: productPricingRules.salesDiscountPct,
          listPrice: productPricingRules.listPrice,
          defaultPacking: productVariants.defaultPacking,
          boxQuantity: productVariants.boxQuantity,
          lowStockThreshold: productVariants.lowStockThreshold,
          isActive: productVariants.isActive,
          sortOrder: productVariants.sortOrder,
          createdAt: productVariants.createdAt,
          updatedAt: productVariants.updatedAt,
          deletedAt: productVariants.deletedAt,
          stockQuantity: sql<number>`COALESCE(SUM(${inventory.quantityOnHand}), 0)::int`,
        })
        .from(productVariants)
        .leftJoin(inventory, eq(productVariants.id, inventory.variantId))
        .leftJoin(productPricingRules, and(eq(productVariants.id, productPricingRules.variantId), isNull(productPricingRules.priceListId)))
        .leftJoin(categories, eq(productVariants.categoryId, categories.id))
        .where(
          and(
            eq(productVariants.orgId, orgId),
            inArray(productVariants.productId, productIds),
            isNull(productVariants.deletedAt),
            eq(productVariants.isActive, true)
          )
        )
        .groupBy(productVariants.id, productPricingRules.id, categories.id)
        .orderBy(productVariants.sortOrder);

      imagesList = await db
        .select()
        .from(productImages)
        .where(
          and(
            eq(productImages.orgId, orgId),
            inArray(productImages.productId, productIds)
          )
        )
        .orderBy(productImages.sortOrder);
    }

    // Query active promotions for this organization
    const today = new Date().toISOString().split('T')[0];
    const activePromos = await db.query.promotionalSchemes.findMany({
      where: (ps, { and, eq, lte, gte }) => and(
        eq(ps.orgId, orgId),
        eq(ps.isActive, true),
        lte(ps.validFrom, today),
        gte(ps.validTo, today)
      ),
      with: {
        items: true,
      },
      orderBy: (ps, { desc }) => [desc(ps.priority), desc(ps.createdAt)],
    });


    const dataWithVariantsAndImages = data.map((p) => {
      const pImages = imagesList
        .filter((img) => img.productId === p.id)
        .map((img) => ({
          ...img,
          url: getS3PublicUrl(img.url),
          thumbnailUrl: img.thumbnailUrl ? getS3PublicUrl(img.thumbnailUrl) : getS3PublicUrl(img.url),
        }));

      let computedSellingPrice = '0';
      if (p.purchaseMode === 'list' && p.salesDiscountPct && Number(p.salesDiscountPct) > 0) {
        computedSellingPrice = (Math.round(Number(p.listPrice || 0) * (1 - Number(p.salesDiscountPct) / 100) * 2) / 2).toFixed(2);
      } else {
        computedSellingPrice = (Math.round(Number(p.valuationCost || 0) * (1 + Number(p.marginPct || 0) / 100) * 2) / 2).toFixed(2);
      }
      
      // Find applicable promotion for this base product
      const findPromo = (prodId: string, catId?: string | null, brId?: string | null, varId?: string | null) => {
        for (const promo of activePromos) {
          let applies = false;
          if (promo.appliesTo === 'all_products') {
            applies = true;
          } else if (promo.appliesTo === 'specific_brands' && brId) {
            applies = promo.items?.some((it: any) => it.brandId === brId) || false;
          } else if (promo.appliesTo === 'specific_categories' && catId) {
            applies = promo.items?.some((it: any) => it.categoryId === catId) || false;
          } else if (promo.appliesTo === 'specific_products') {
            applies = promo.items?.some((it: any) => it.productId === prodId && (!it.variantId || it.variantId === varId)) || false;
          } else if (promo.appliesTo === 'specific_variants' && varId) {
            applies = promo.items?.some((it: any) => it.variantId === varId) || false;
          }

          if (applies) {
            return promo;
          }
        }
        return null;
      };

      const calculatePromoPrice = (basePrice: number, promo: any) => {
        if (!promo || basePrice <= 0) return null;
        let discount = 0;
        if (promo.discountType === 'percentage') {
          discount = (basePrice * Number(promo.discountValue)) / 100;
          if (promo.maxDiscountAmount && discount > Number(promo.maxDiscountAmount)) {
            discount = Number(promo.maxDiscountAmount);
          }
        } else {
          discount = Number(promo.discountValue);
        }
        const discounted = Math.max(0, basePrice - discount);
        return {
          promoPrice: (Math.round(discounted * 2) / 2).toFixed(2),
          discountAmount: discount.toFixed(2),
          badgeText: promo.badgeText || (promo.discountType === 'percentage' ? `${Number(promo.discountValue)}% OFF` : `₹${promo.discountValue} OFF`),
          schemeName: promo.name,
          promoType: promo.promoType,
        };
      };

      const productPromo = findPromo(p.id, p.categoryId, p.brandId, null);

      const pVariants = variantsList
        .filter((v) => v.productId === p.id)
        .map(v => {
          const effectivePurchaseMode = v.purchaseMode || p.purchaseMode;
          const effectiveSalesDiscountPct = v.salesDiscountPct !== null && v.salesDiscountPct !== undefined ? v.salesDiscountPct : p.salesDiscountPct;
          const effectiveListPrice = v.listPrice !== null && v.listPrice !== undefined ? v.listPrice : p.listPrice;
          const effectiveMarginPct = v.marginPct !== null && v.marginPct !== undefined ? v.marginPct : p.marginPct;
          
          let vSellingPrice = '0';
          if (effectivePurchaseMode === 'list' && effectiveSalesDiscountPct && Number(effectiveSalesDiscountPct) > 0) {
            vSellingPrice = (Math.round(Number(effectiveListPrice || 0) * (1 - Number(effectiveSalesDiscountPct) / 100) * 2) / 2).toFixed(2);
          } else {
            vSellingPrice = (Math.round(Number(v.valuationCost || 0) * (1 + Number(effectiveMarginPct || 0) / 100) * 2) / 2).toFixed(2);
          }

          const variantPromo = findPromo(p.id, v.categoryId || p.categoryId, p.brandId, v.id) || productPromo;
          const variantPromoCalculation = calculatePromoPrice(Number(v.mrp || vSellingPrice || 0), variantPromo);
          
          return {
            ...v,
            sellingPrice: vSellingPrice,
            promoPrice: variantPromoCalculation?.promoPrice || null,
            promoBadge: variantPromoCalculation?.badgeText || null,
            promotion: variantPromoCalculation ? {
              name: variantPromoCalculation.schemeName,
              badgeText: variantPromoCalculation.badgeText,
              discountAmount: variantPromoCalculation.discountAmount,
              promoType: variantPromoCalculation.promoType,
            } : null,
          };
        });

      const effectiveBasePrice = Number(p.mrp || 0) > 0 
        ? Number(p.mrp)
        : (pVariants.length > 0 
            ? Math.min(...pVariants.map((v: any) => Number(v.mrp) || 0).filter((val: number) => val > 0).concat([Number(computedSellingPrice) || 0]))
            : Number(computedSellingPrice || 0));

      const productPromoCalculation = calculatePromoPrice(effectiveBasePrice, productPromo);

      const resolvedShortDesc = p.shortDescription || (p.name ? `High quality ${p.name}${p.brandName ? ` by ${p.brandName}` : ''}${p.categoryName ? ` in ${p.categoryName}` : ''}. Engineered for long-lasting durability and performance.` : null);

      // If parent has no promo calculation but variants do, inherit first variant's promo info for card badge
      const activeVariantPromo = pVariants.find(v => v.promoPrice || v.promoBadge);
      const effectivePromoPrice = productPromoCalculation?.promoPrice || activeVariantPromo?.promoPrice || null;
      const effectivePromoBadge = productPromoCalculation?.badgeText || activeVariantPromo?.promoBadge || null;
      const effectivePromotion = productPromoCalculation ? {
        name: productPromoCalculation.schemeName,
        badgeText: productPromoCalculation.badgeText,
        discountAmount: productPromoCalculation.discountAmount,
        promoType: productPromoCalculation.promoType,
      } : (activeVariantPromo?.promotion || null);

      return {
        ...p,
        shortDescription: resolvedShortDesc,
        sellingPrice: computedSellingPrice,
        promoPrice: effectivePromoPrice,
        promoBadge: effectivePromoBadge,
        promotion: effectivePromotion,
        variants: pVariants,
        images: pImages,
      };
    });

    if (filters.flattenVariants) {
      const flattened: any[] = [];
      dataWithVariantsAndImages.forEach((p) => {
        if (p.hasVariants && p.variants && p.variants.length > 0) {
          p.variants.forEach((v: any) => {
            flattened.push({
              id: p.id,
              variantId: v.id,
              name: p.name,
              variantName: v.name,
              categoryName: p.categoryName,
              brandName: p.brandName,
              hsnCode: p.hsnCode,
              type: p.type,
              sku: v.sku || p.sku || '',
              barcode: v.barcode || p.barcode || '',
              sellingPrice: v.sellingPrice,
              stockQuantity: Number(v.stockQuantity) || 0,
              lowStockThreshold: Number(v.lowStockThreshold) || 10,
              trackInventory: p.trackInventory,
              status: p.status,
              hasVariants: true,
              shortDescription: p.shortDescription,
              description: p.description,
              uomCode: p.uomCode,
              costPrice: v.valuationCost || p.valuationCost || '0',
              mrp: v.mrp || p.mrp || '0',
              rawProduct: p,
              rawVariant: v,
            });
          });
        } else {
          flattened.push({
            id: p.id,
            name: p.name,
            categoryName: p.categoryName,
            brandName: p.brandName,
            hsnCode: p.hsnCode,
            type: p.type,
            sku: p.sku || '',
            barcode: p.barcode || '',
            sellingPrice: p.sellingPrice,
            stockQuantity: Number(p.stockQuantity) || 0,
            lowStockThreshold: 10,
            trackInventory: p.trackInventory,
            status: p.status,
            hasVariants: false,
            shortDescription: p.shortDescription,
            description: p.description,
            uomCode: p.uomCode,
            costPrice: p.valuationCost || '0',
            mrp: p.mrp || '0',
            rawProduct: p,
          });
        }
      });

      const pageNum = filters.page || 1;
      const sliced = flattened.slice((pageNum - 1) * limit, pageNum * limit);

      return {
        data: sliced,
        pagination: {
          page: pageNum,
          limit,
          total: flattened.length,
          totalPages: Math.ceil(flattened.length / limit),
        }
      };
    }

    return {
      data: dataWithVariantsAndImages,
      pagination: {
        page: filters.page || 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get product details with variants and images.
   */
  async getProductById(orgId: string, id: string) {
    const [product] = await db
      .select({
        id: products.id,
        orgId: products.orgId,
        categoryId: products.categoryId,
        brandId: products.brandId,
        taxRateId: products.taxRateId,
        hsnCodeId: products.hsnCodeId,
        name: products.name,
        slug: products.slug,
        description: products.description,
        shortDescription: products.shortDescription,
        type: products.type,
        sku: products.sku,
        barcode: products.barcode,
        valuationCost: products.valuationCost,
        purchaseMode: productPricingRules.purchaseMode,
        marginPct: productPricingRules.marginPct,
        discountPct: productPricingRules.discountPct,
        salesDiscountPct: productPricingRules.salesDiscountPct,
        listPrice: productPricingRules.listPrice,
        mrp: products.mrp,
        preferredSupplierId: products.preferredSupplierId,
        uomId: products.uomId,
        boxQuantity: products.boxQuantity,
        hasVariants: products.hasVariants,
        isTaxable: products.isTaxable,
        trackInventory: products.trackInventory,
        status: products.status,
        metaTitle: products.metaTitle,
        metaDescription: products.metaDescription,
        tags: products.tags,
        attributes: products.attributes,
        createdBy: products.createdBy,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        deletedAt: products.deletedAt,
        stockQuantity: sql<number>`COALESCE((
          SELECT SUM(quantity_on_hand)
          FROM inventory
          WHERE inventory.product_id = products.id AND inventory.variant_id IS NULL
        ), 0)::int`,
        openingQuantity: sql<number>`COALESCE((
          SELECT quantity_change
          FROM inventory_transactions
          INNER JOIN inventory ON inventory.id = inventory_transactions.inventory_id
          WHERE inventory.product_id = products.id AND inventory.variant_id IS NULL AND inventory_transactions.type = 'opening_stock'
          LIMIT 1
        ), 0)::int`,
      })
      .from(products)
      .leftJoin(productPricingRules, and(eq(products.id, productPricingRules.productId), isNull(productPricingRules.variantId), isNull(productPricingRules.priceListId)))
      .where(and(eq(products.orgId, orgId), eq(products.id, id), isNull(products.deletedAt)))
      .limit(1);

    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    // Fetch variants
    const variants = await db
      .select({
        id: productVariants.id,
        orgId: productVariants.orgId,
        productId: productVariants.productId,
        sku: productVariants.sku,
        barcode: productVariants.barcode,
        name: productVariants.name,
        categoryId: productVariants.categoryId,
        categoryName: categories.name,
        attributes: productVariants.attributes,
        valuationCost: productVariants.valuationCost,
        mrp: productVariants.mrp,
        
        purchaseMode: productPricingRules.purchaseMode,
        marginPct: productPricingRules.marginPct,
        discountPct: productPricingRules.discountPct,
        salesDiscountPct: productPricingRules.salesDiscountPct,
        listPrice: productPricingRules.listPrice,
        defaultPacking: productVariants.defaultPacking,
        boxQuantity: productVariants.boxQuantity,
        preferredSupplierId: productVariants.preferredSupplierId,
        lowStockThreshold: productVariants.lowStockThreshold,
        isActive: productVariants.isActive,
        sortOrder: productVariants.sortOrder,
        createdAt: productVariants.createdAt,
        updatedAt: productVariants.updatedAt,
        deletedAt: productVariants.deletedAt,
        stockQuantity: sql<number>`COALESCE(SUM(${inventory.quantityOnHand}), 0)::int`,
        openingQuantity: sql<number>`COALESCE((
          SELECT quantity_change
          FROM inventory_transactions
          INNER JOIN inventory ON inventory.id = inventory_transactions.inventory_id
          WHERE inventory.variant_id = product_variants.id AND inventory_transactions.type = 'opening_stock'
          LIMIT 1
        ), 0)::int`,
      })
      .from(productVariants)
      .leftJoin(inventory, eq(productVariants.id, inventory.variantId))
      .leftJoin(productPricingRules, and(eq(productVariants.id, productPricingRules.variantId), isNull(productPricingRules.priceListId)))
      .leftJoin(categories, eq(productVariants.categoryId, categories.id))
      .where(and(eq(productVariants.orgId, orgId), eq(productVariants.productId, id), isNull(productVariants.deletedAt)))
      .groupBy(productVariants.id, productPricingRules.id, categories.id)
      .orderBy(productVariants.sortOrder);

    // Fetch images
    const rawImages = await db
      .select()
      .from(productImages)
      .where(and(eq(productImages.orgId, orgId), eq(productImages.productId, id)))
      .orderBy(productImages.sortOrder);

    const images = rawImages.map((img) => ({
      ...img,
      url: getS3PublicUrl(img.url),
      thumbnailUrl: img.thumbnailUrl ? getS3PublicUrl(img.thumbnailUrl) : getS3PublicUrl(img.url),
    }));

    // Fetch master references for extra context in parallel
    const [
      categoryRes,
      brandRes,
      taxRateRes,
      uomRes,
      hsnCodeRes
    ] = await Promise.all([
      product.categoryId ? db.select().from(categories).where(eq(categories.id, product.categoryId)).limit(1) : Promise.resolve([null]),
      product.brandId ? db.select().from(brands).where(eq(brands.id, product.brandId)).limit(1) : Promise.resolve([null]),
      product.taxRateId ? db.select().from(taxRates).where(eq(taxRates.id, product.taxRateId)).limit(1) : Promise.resolve([null]),
      product.uomId ? db.select().from(unitsOfMeasurement).where(eq(unitsOfMeasurement.id, product.uomId)).limit(1) : Promise.resolve([null]),
      product.hsnCodeId ? db.select().from(hsnCodes).where(eq(hsnCodes.id, product.hsnCodeId)).limit(1) : Promise.resolve([null])
    ]);

    const category = categoryRes[0];
    const brand = brandRes[0];
    const taxRate = taxRateRes[0];
    const uom = uomRes[0];
    const hsnCode = hsnCodeRes[0];

    const pVariants = variants.map(v => {
      const effectivePurchaseMode = v.purchaseMode || product.purchaseMode;
      const effectiveSalesDiscountPct = v.salesDiscountPct !== null && v.salesDiscountPct !== undefined ? v.salesDiscountPct : product.salesDiscountPct;
      const effectiveListPrice = v.listPrice !== null && v.listPrice !== undefined ? v.listPrice : product.listPrice;
      const effectiveMarginPct = v.marginPct !== null && v.marginPct !== undefined ? v.marginPct : product.marginPct;
      
      let vSellingPrice = '0';
      if (effectivePurchaseMode === 'list' && effectiveSalesDiscountPct && Number(effectiveSalesDiscountPct) > 0) {
        vSellingPrice = (Math.round(Number(effectiveListPrice || 0) * (1 - Number(effectiveSalesDiscountPct) / 100) * 2) / 2).toFixed(2);
      } else {
        vSellingPrice = (Math.round(Number(v.valuationCost || 0) * (1 + Number(effectiveMarginPct || 0) / 100) * 2) / 2).toFixed(2);
      }
      
      return {
        ...v,
        sellingPrice: vSellingPrice
      };
    });

    let computedSellingPrice = '0';
    if (product.purchaseMode === 'list' && product.salesDiscountPct && Number(product.salesDiscountPct) > 0) {
      computedSellingPrice = (Math.round(Number(product.listPrice || 0) * (1 - Number(product.salesDiscountPct) / 100) * 2) / 2).toFixed(2);
    } else {
      computedSellingPrice = (Math.round(Number(product.valuationCost || 0) * (1 + Number(product.marginPct || 0) / 100) * 2) / 2).toFixed(2);
    }

    return {
      ...product,
      sellingPrice: computedSellingPrice,
      category,
      brand,
      taxRate,
      uom,
      hsnCode,
      variants: pVariants,
      images,
    };
  },

  /**
   * Bulk create products and their variants sequentially.
   */
  async bulkCreateProducts(orgId: string, userId: string, inputs: CreateProductInput[]) {
    const results = [];
    const errors = [];
    let successCount = 0;

    for (const [index, input] of inputs.entries()) {
      try {
        const product = await this.createProduct(orgId, userId, input);
        results.push({ index, status: 'success', id: product.id });
        successCount++;
      } catch (err: any) {
        errors.push({ index, name: input.name, error: err.message });
        results.push({ index, status: 'error', error: err.message });
      }
    }

    return { successCount, totalCount: inputs.length, results, errors };
  },

  /**
   * Helper to check duplicate product with same name/model, brand, and category.
   */
  async checkDuplicateProduct(
    orgId: string,
    name: string,
    categoryId: string | null | undefined,
    brandId: string | null | undefined,
    excludeId?: string
  ) {
    const cleanName = name.trim();
    const catId = categoryId || null;
    const brId = brandId || null;

    const conditions = [
      eq(products.orgId, orgId),
      sql`LOWER(${products.name}) = LOWER(${cleanName})`,
      isNull(products.deletedAt),
    ];

    if (catId) {
      conditions.push(eq(products.categoryId, catId));
    } else {
      conditions.push(isNull(products.categoryId));
    }

    if (brId) {
      conditions.push(eq(products.brandId, brId));
    } else {
      conditions.push(isNull(products.brandId));
    }

    if (excludeId) {
      conditions.push(sql`${products.id} != ${excludeId}`);
    }

    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      throw new ApiError(
        400,
        `A product with this Model Name, Category, and Brand already exists.`
      );
    }
  },

  /**
   * Create a new product.
   */
  async createProduct(orgId: string, userId: string, input: CreateProductInput) {
    await this.checkDuplicateProduct(orgId, input.name, input.categoryId, input.brandId);

    let slug = slugify(input.name);
    // Ensure slug uniqueness within org
    const [existing] = await db
      .select()
      .from(products)
      .where(and(eq(products.orgId, orgId), eq(products.slug, slug), isNull(products.deletedAt)))
      .limit(1);

    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const { variants, images, ...productFields } = input;

    return await db.transaction(async (tx) => {
  // 1. Insert product
      const [product] = await tx
        .insert(products)
        .values({
          orgId,
          name: productFields.name,
          slug,
          categoryId: productFields.categoryId || null,
          brandId: productFields.brandId || null,
          taxRateId: productFields.taxRateId || null,
          hsnCodeId: productFields.hsnCodeId || null,
          description: productFields.description || null,
          shortDescription: productFields.shortDescription || null,
          type: productFields.type as any,
          sku: productFields.sku || null,
          barcode: productFields.barcode || null,
          valuationCost: Number(productFields.costPrice || 0).toFixed(2),
          mrp: Number(productFields.mrp || 0).toFixed(2),
          uomId: productFields.uomId || null,
          hasVariants: productFields.hasVariants ?? false,
          isTaxable: productFields.isTaxable ?? true,
          trackInventory: productFields.trackInventory ?? true,
          boxQuantity: productFields.boxQuantity ?? 1,
          preferredSupplierId: productFields.preferredSupplierId || null,
          status: productFields.status as any,
          metaTitle: productFields.metaTitle || null,
          metaDescription: productFields.metaDescription || null,
          tags: productFields.tags || [],
          attributes: productFields.attributes || {},
          createdBy: userId,
        })
        .returning();

      // Insert base product pricing rule
      await tx.insert(productPricingRules).values({
        orgId,
        productId: product.id,
        purchaseMode: productFields.purchaseMode || 'direct',
        marginPct: productFields.marginPct !== undefined ? Number(productFields.marginPct).toFixed(2) : '0',
        discountPct: productFields.discountPct !== undefined ? Number(productFields.discountPct).toFixed(2) : '0',
        salesDiscountPct: productFields.salesDiscountPct !== undefined ? Number(productFields.salesDiscountPct).toFixed(2) : '0',
        listPrice: productFields.listPrice !== undefined ? Number(productFields.listPrice).toFixed(2) : '0',
      });

      // 2. Insert variants if applicable
      const createdVariants: any[] = [];
      const variantClientMap = new Map<string, string>();
      
      // Resolve default warehouse (needed for both variant and base product stock init)
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

      if (!productFields.hasVariants && warehouseId && productFields.trackInventory) {
        const initialQty = productFields.stockQuantity ?? 0;
        const [invRecord] = await tx
          .insert(inventory)
          .values({
            orgId,
            warehouseId,
            productId: product.id,
            variantId: null,
            quantityOnHand: initialQty,
            quantityReserved: 0,
            reorderLevel: 10,
            reorderQuantity: 50,
          })
          .returning();

        if (initialQty > 0) {
          await tx
            .insert(inventoryTransactions)
            .values({
              orgId,
              inventoryId: invRecord.id,
              type: 'opening_stock',
              quantityChange: initialQty,
              quantityAfter: initialQty,
              notes: 'Opening Stock (Base Product Creation)',
              createdBy: userId,
            });
        }
      }

      if (!productFields.hasVariants) {
        // Log initial price history for the base product
        await tx
          .insert(productVariantPriceHistory)
          .values({
            orgId,
            productId: product.id,
            variantId: null,
            
            
            
            mrp: product.mrp,
            
            
            
            valuationCost: '0',
            
            
            
            createdBy: userId,
          });
      }

      if (productFields.hasVariants && variants && variants.length > 0) {

        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          const [variant] = await tx
            .insert(productVariants)
            .values({
              orgId,
              productId: product.id,
              sku: generateVariantSku(product.name, v.attributes),
              barcode: v.barcode || null,
              name: v.name,
              categoryId: v.categoryId || null,
              attributes: v.attributes,
              valuationCost: Number(v.costPrice || 0).toFixed(2),
              mrp: Number(v.mrp || 0).toFixed(2),
              defaultPacking: v.defaultPacking || null,
              boxQuantity: v.boxQuantity ?? 1,
              preferredSupplierId: v.preferredSupplierId || productFields.preferredSupplierId || null,
              stockQuantity: v.stockQuantity ?? 0,
              lowStockThreshold: v.lowStockThreshold ?? 10,
              isActive: v.isActive ?? true,
              sortOrder: i,
            })
            .returning();

          // Insert variant pricing rule
          await tx.insert(productPricingRules).values({
            orgId,
            productId: product.id,
            variantId: variant.id,
            purchaseMode: v.purchaseMode || null,
            marginPct: v.marginPct !== null && v.marginPct !== undefined ? Number(v.marginPct).toFixed(2) : null,
            discountPct: v.discountPct !== null && v.discountPct !== undefined ? Number(v.discountPct).toFixed(2) : null,
            salesDiscountPct: v.salesDiscountPct !== null && v.salesDiscountPct !== undefined ? Number(v.salesDiscountPct).toFixed(2) : null,
            listPrice: v.listPrice !== null && v.listPrice !== undefined ? Number(v.listPrice).toFixed(2) : '0',
          });

          // Log initial price history
          await tx
            .insert(productVariantPriceHistory)
            .values({
              orgId,
              productId: product.id,
              variantId: variant.id,
              
              
              
              mrp: variant.mrp,
              
              
              
              valuationCost: '0',
              
              
              
              createdBy: userId,
            });

          // Initialize inventory record for the variant
          if (warehouseId) {
            const initialQty = v.stockQuantity ?? 0;
            const [invRecord] = await tx
              .insert(inventory)
              .values({
                orgId,
                warehouseId,
                productId: product.id,
                variantId: variant.id,
                quantityOnHand: initialQty,
                quantityReserved: 0,
                reorderLevel: variant.lowStockThreshold,
                reorderQuantity: 50,
              })
              .returning();

            if (initialQty > 0) {
              await tx
                .insert(inventoryTransactions)
                .values({
                  orgId,
                  inventoryId: invRecord.id,
                  type: 'opening_stock',
                  quantityChange: initialQty,
                  quantityAfter: initialQty,
                  notes: 'Opening Stock (Product Creation)',
                  createdBy: userId,
                });
            }
          }

          createdVariants.push(variant);
          if (v.clientKey) {
            variantClientMap.set(v.clientKey, variant.id);
          }
        }
      }

      // 3. Insert images if applicable
      const createdImages: any[] = [];
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          const relativeKey = extractS3Key(img.url);
          const relativeThumbKey = img.thumbnailUrl ? extractS3Key(img.thumbnailUrl) : relativeKey;

          let variantId = img.variantId || null;
          if (img.variantClientKey && variantClientMap.has(img.variantClientKey)) {
            variantId = variantClientMap.get(img.variantClientKey)!;
          }

          const [image] = await tx
            .insert(productImages)
            .values({
              orgId,
              productId: product.id,
              url: relativeKey,
              thumbnailUrl: relativeThumbKey,
              altText: img.altText || null,
              sortOrder: img.sortOrder ?? i,
              isPrimary: img.isPrimary ?? false,
              variantId,
            })
            .returning();

          createdImages.push({
            ...image,
            url: getS3PublicUrl(image.url),
            thumbnailUrl: image.thumbnailUrl ? getS3PublicUrl(image.thumbnailUrl) : getS3PublicUrl(image.url),
          });
        }
      }

      return {
        ...product,
        variants: createdVariants,
        images: createdImages,
      };
    });
  },

  /**
   * Update product and synchronize its variants.
   */
  async updateProduct(orgId: string, id: string, userId: string, input: UpdateProductInput) {
    const productDetail = await this.getProductById(orgId, id);

    const targetName = input.name !== undefined ? input.name : productDetail.name;
    const targetCategoryId = input.categoryId !== undefined ? input.categoryId : productDetail.categoryId;
    const targetBrandId = input.brandId !== undefined ? input.brandId : productDetail.brandId;

    if (input.name !== undefined || input.categoryId !== undefined || input.brandId !== undefined) {
      await this.checkDuplicateProduct(orgId, targetName, targetCategoryId, targetBrandId, id);
    }

    let updateData: any = { ...input, updatedAt: new Date() };
    if (input.name) {
      let slug = slugify(input.name);
      const [existing] = await db
        .select()
        .from(products)
        .where(and(eq(products.orgId, orgId), eq(products.slug, slug), isNull(products.deletedAt)))
        .limit(1);

      if (existing && existing.id !== id) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
      updateData.slug = slug;
    }

    if (updateData.costPrice !== undefined) updateData.valuationCost = Number(updateData.costPrice).toFixed(2);
    if (updateData.mrp !== undefined) updateData.mrp = Number(updateData.mrp).toFixed(2);
    if (updateData.listPrice !== undefined) updateData.listPrice = Number(updateData.listPrice).toFixed(2);
    if (updateData.marginPct !== undefined) updateData.marginPct = Number(updateData.marginPct).toFixed(2);
    if (updateData.discountPct !== undefined) updateData.discountPct = Number(updateData.discountPct).toFixed(2);
    if (updateData.salesDiscountPct !== undefined) updateData.salesDiscountPct = Number(updateData.salesDiscountPct).toFixed(2);
    
    const { 
      variants, images, basePrice, sellingPrice, costPrice, 
      listPrice, marginPct, discountPct, salesDiscountPct, purchaseMode, 
      ...productFields 
    } = updateData;

    // Convert numeric strings/numbers correctly for Drizzle update
    return await db.transaction(async (tx) => {
      // 1. Update product
      const [product] = await tx
        .update(products)
        .set(productFields)
        .where(and(eq(products.orgId, orgId), eq(products.id, id)))
        .returning();

      // Upsert base pricing rule
      if (listPrice !== undefined || marginPct !== undefined || discountPct !== undefined || salesDiscountPct !== undefined || purchaseMode !== undefined) {
        await tx.delete(productPricingRules)
          .where(and(
            eq(productPricingRules.productId, product.id),
            isNull(productPricingRules.variantId),
            isNull(productPricingRules.priceListId)
          ));
          
        await tx.insert(productPricingRules).values({
          orgId,
          productId: product.id,
          purchaseMode: purchaseMode || productDetail.purchaseMode || 'direct',
          marginPct: marginPct !== undefined ? marginPct : (productDetail.marginPct || '0'),
          discountPct: discountPct !== undefined ? discountPct : (productDetail.discountPct || '0'),
          salesDiscountPct: salesDiscountPct !== undefined ? salesDiscountPct : (productDetail.salesDiscountPct || '0'),
          listPrice: listPrice !== undefined ? listPrice : (productDetail.listPrice || '0'),
        });
      }

      if (!product.hasVariants) {
        const priceChanged = 
          (productFields.mrp !== undefined && Number(productFields.mrp) !== Number(productDetail.mrp));
        
        if (priceChanged) {
          await tx
            .insert(productVariantPriceHistory)
            .values({
              orgId,
              productId: product.id,
              variantId: null,
              
              
              
              mrp: product.mrp,
              
              
              
              valuationCost: '0',
              
              
              
              createdBy: userId,
            });
        }
      }

      // 2. Sync variants if provided
      const variantClientMap = new Map<string, string>();
      const prodName = productFields.name || productDetail.name;
      
      // Resolve default warehouse (needed for both base product and variant stock sync)
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

      // Sync opening stock for base product
      if (!product.hasVariants && productFields.stockQuantity !== undefined) {
        if (warehouseId) {
          let [invRecord] = await tx.select().from(inventory).where(and(eq(inventory.productId, id), isNull(inventory.variantId)));
          if (!invRecord) {
            const [newInvRecord] = await tx.insert(inventory).values({
              orgId, warehouseId, productId: id, variantId: null,
              quantityOnHand: 0, quantityReserved: 0, reorderLevel: 10, reorderQuantity: 50
            }).returning();
            invRecord = newInvRecord;
          }
          if (invRecord) {
            let [openingTx] = await tx.select().from(inventoryTransactions).where(and(eq(inventoryTransactions.inventoryId, invRecord.id), eq(inventoryTransactions.type, 'opening_stock')));
            const newOpening = Number(productFields.stockQuantity);
            const oldOpening = openingTx ? openingTx.quantityChange : 0;
            const diff = newOpening - oldOpening;
            if (diff !== 0) {
              if (openingTx) {
                await tx.update(inventoryTransactions).set({ quantityChange: newOpening, quantityAfter: newOpening }).where(eq(inventoryTransactions.id, openingTx.id));
              } else if (newOpening > 0) {
                await tx.insert(inventoryTransactions).values({ orgId, inventoryId: invRecord.id, type: 'opening_stock', quantityChange: newOpening, quantityAfter: newOpening, notes: 'Opening Stock (Product Update)', createdBy: userId });
              }
              await tx.update(inventory).set({ quantityOnHand: invRecord.quantityOnHand + diff }).where(eq(inventory.id, invRecord.id));
            }
          }
        }
      }
      if (variants !== undefined) {
        const existingVariants = productDetail.variants;
        const incomingIds = variants.map((v: any) => v.id).filter(Boolean);
        const toDelete = existingVariants.filter((ev) => !incomingIds.includes(ev.id));
        for (const ev of toDelete) {
          await tx
            .update(productVariants)
            .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
            .where(and(eq(productVariants.orgId, orgId), eq(productVariants.id, ev.id)));
        }

        // Insert or update incoming variants
        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          const existingVar = v.id ? existingVariants.find((ev) => ev.id === v.id) : null;
          const attrs = v.attributes !== undefined ? v.attributes : (existingVar ? existingVar.attributes : {});
          const calculatedSku = generateVariantSku(prodName, attrs);

          if (v.id) {
            // Update existing variant
            const priceChanged = existingVar ? (
              Number(existingVar.mrp || 0) !== Number(v.mrp || 0) ||
              existingVar.purchaseMode !== (v.purchaseMode || null)
            ) : false;

            await tx
              .update(productVariants)
              .set({
                sku: calculatedSku,
                barcode: v.barcode,
                name: v.name,
                categoryId: v.categoryId || null,
                attributes: v.attributes,
                valuationCost: v.costPrice !== undefined ? Number(v.costPrice).toFixed(2) : undefined,
                mrp: v.mrp !== undefined ? Number(v.mrp).toFixed(2) : undefined,
                defaultPacking: v.defaultPacking || null,
                boxQuantity: v.boxQuantity,
                preferredSupplierId: v.preferredSupplierId !== undefined ? v.preferredSupplierId : (productFields.preferredSupplierId !== undefined ? productFields.preferredSupplierId : existingVar?.preferredSupplierId),
                lowStockThreshold: v.lowStockThreshold,
                isActive: v.isActive,
                sortOrder: i,
                updatedAt: new Date(),
              })
              .where(and(eq(productVariants.orgId, orgId), eq(productVariants.id, v.id)));

            if (v.listPrice !== undefined || v.marginPct !== undefined || v.discountPct !== undefined || v.salesDiscountPct !== undefined || v.purchaseMode !== undefined) {
              await tx.delete(productPricingRules)
                .where(and(
                  eq(productPricingRules.variantId, v.id),
                  isNull(productPricingRules.priceListId)
                ));
              await tx.insert(productPricingRules).values({
                orgId,
                productId: id,
                variantId: v.id,
                purchaseMode: v.purchaseMode || existingVar?.purchaseMode || null,
                marginPct: v.marginPct !== undefined ? (v.marginPct !== null ? Number(v.marginPct).toFixed(2) : null) : (existingVar?.marginPct || null),
                discountPct: v.discountPct !== undefined ? (v.discountPct !== null ? Number(v.discountPct).toFixed(2) : null) : (existingVar?.discountPct || null),
                salesDiscountPct: v.salesDiscountPct !== undefined ? (v.salesDiscountPct !== null ? Number(v.salesDiscountPct).toFixed(2) : null) : (existingVar?.salesDiscountPct || null),
                listPrice: v.listPrice !== undefined ? (v.listPrice !== null ? Number(v.listPrice).toFixed(2) : '0') : (existingVar?.listPrice || '0'),
              });
            }

            if (priceChanged) {
              await tx
                .insert(productVariantPriceHistory)
                .values({
                  orgId,
                  productId: id,
                  variantId: v.id,
                  
                  
                  
                  mrp: Number(v.mrp || 0).toFixed(2),
                  
                  
                  
                  valuationCost: '0',
                  
                  
                  
                  createdBy: userId,
                });
            }

            // Sync opening stock for existing variant
            if (v.stockQuantity !== undefined && warehouseId) {
              let [invRecord] = await tx.select().from(inventory).where(and(eq(inventory.productId, id), eq(inventory.variantId, v.id)));
              if (!invRecord) {
                const [newInvRecord] = await tx.insert(inventory).values({
                  orgId, warehouseId, productId: id, variantId: v.id,
                  quantityOnHand: 0, quantityReserved: 0, reorderLevel: v.lowStockThreshold || 10, reorderQuantity: 50
                }).returning();
                invRecord = newInvRecord;
              }
              if (invRecord) {
                let [openingTx] = await tx.select().from(inventoryTransactions).where(and(eq(inventoryTransactions.inventoryId, invRecord.id), eq(inventoryTransactions.type, 'opening_stock')));
                const newOpening = Number(v.stockQuantity);
                const oldOpening = openingTx ? openingTx.quantityChange : 0;
                const diff = newOpening - oldOpening;
                if (diff !== 0) {
                  if (openingTx) {
                    await tx.update(inventoryTransactions).set({ quantityChange: newOpening, quantityAfter: newOpening }).where(eq(inventoryTransactions.id, openingTx.id));
                  } else if (newOpening > 0) {
                    await tx.insert(inventoryTransactions).values({ orgId, inventoryId: invRecord.id, type: 'opening_stock', quantityChange: newOpening, quantityAfter: newOpening, notes: 'Opening Stock (Product Update)', createdBy: userId });
                  }
                  await tx.update(inventory).set({ quantityOnHand: invRecord.quantityOnHand + diff }).where(eq(inventory.id, invRecord.id));
                }
              }
            }
            if (v.clientKey) {
              variantClientMap.set(v.clientKey, v.id);
            }
          } else {
            // Insert new variant
            const [newVar] = await tx
              .insert(productVariants)
              .values({
                orgId,
                productId: id,
                sku: calculatedSku,
                barcode: v.barcode || null,
                name: v.name,
                categoryId: v.categoryId || null,
                attributes: v.attributes,
                
                
                
                mrp: Number(v.mrp || 0).toFixed(2),
                defaultPacking: v.defaultPacking || null,
                boxQuantity: v.boxQuantity ?? 1,
                preferredSupplierId: v.preferredSupplierId || productFields.preferredSupplierId || productDetail.preferredSupplierId || null,
                stockQuantity: Number(v.stockQuantity) || 0,
                lowStockThreshold: Number(v.lowStockThreshold) || 10,
                isActive: v.isActive ?? true,
                sortOrder: i,
              })
              .returning();

            await tx.insert(productPricingRules).values({
              orgId,
              productId: id,
              variantId: newVar.id,
              purchaseMode: v.purchaseMode || null,
              marginPct: v.marginPct !== undefined ? Number(v.marginPct).toFixed(2) : '0',
              discountPct: v.discountPct !== undefined ? Number(v.discountPct).toFixed(2) : '0',
              salesDiscountPct: v.salesDiscountPct !== undefined ? Number(v.salesDiscountPct).toFixed(2) : '0',
              listPrice: v.listPrice !== undefined ? Number(v.listPrice).toFixed(2) : '0',
            });

            // Log initial price history for new variant
            await tx
              .insert(productVariantPriceHistory)
              .values({
                orgId,
                productId: id,
                variantId: newVar.id,
                
                
                
                mrp: newVar.mrp,
                
                
                
                valuationCost: '0',
                
                
                
                createdBy: userId,
              });

            // Seeding inventory record for new variant
            if (warehouseId) {
              const initialQty = v.stockQuantity ?? 0;
              const [invRecord] = await tx
                .insert(inventory)
                .values({
                  orgId,
                  warehouseId,
                  productId: id,
                  variantId: newVar.id,
                  quantityOnHand: initialQty,
                  quantityReserved: 0,
                  reorderLevel: newVar.lowStockThreshold,
                  reorderQuantity: 50,
                })
                .returning();

              if (initialQty > 0) {
                await tx
                  .insert(inventoryTransactions)
                  .values({
                    orgId,
                    inventoryId: invRecord.id,
                    type: 'opening_stock',
                    quantityChange: initialQty,
                    quantityAfter: initialQty,
                    notes: 'Opening Stock (Product Update)',
                    createdBy: userId,
                  });
              }
            }

            if (v.clientKey) {
              variantClientMap.set(v.clientKey, newVar.id);
            }
          }
        }
      } else if (productFields.name && productFields.name !== productDetail.name) {
        // Cascade SKU change to existing variants when name is updated but variants list is not provided
        const existingVariants = productDetail.variants;
        for (const ev of existingVariants) {
          const newSku = generateVariantSku(productFields.name, ev.attributes);
          await tx
            .update(productVariants)
            .set({ sku: newSku, updatedAt: new Date() })
            .where(and(eq(productVariants.orgId, orgId), eq(productVariants.id, ev.id)));
        }
      }

      // 3. Sync images if provided
      if (images !== undefined) {
        const existingImages = productDetail.images || [];
        const incomingIds = images.map((img: any) => img.id).filter(Boolean);

        // Delete images that are missing in the incoming list
        const toDelete = existingImages.filter((eImg) => !incomingIds.includes(eImg.id));
        for (const eImg of toDelete) {
          await tx
            .delete(productImages)
            .where(and(eq(productImages.orgId, orgId), eq(productImages.id, eImg.id)));
            
          // Delete from S3 bucket
          try {
            const { deleteImageFromS3 } = await import('../../utils/s3.js');
            await deleteImageFromS3(eImg.url);
          } catch (err) {
            console.error('Failed to delete image from S3:', err);
          }
        }

        // Insert or update incoming images
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          const relativeKey = extractS3Key(img.url);
          const relativeThumbKey = img.thumbnailUrl ? extractS3Key(img.thumbnailUrl) : relativeKey;

          let variantId = img.variantId || null;
          if (img.variantClientKey && variantClientMap.has(img.variantClientKey)) {
            variantId = variantClientMap.get(img.variantClientKey)!;
          }

          if (img.id) {
            // Update existing image
            await tx
              .update(productImages)
              .set({
                url: relativeKey,
                thumbnailUrl: relativeThumbKey,
                altText: img.altText || null,
                sortOrder: img.sortOrder ?? i,
                isPrimary: img.isPrimary ?? false,
                variantId,
              })
              .where(and(eq(productImages.orgId, orgId), eq(productImages.id, img.id)));
          } else {
            // Insert new image
            await tx
              .insert(productImages)
              .values({
                orgId,
                productId: id,
                url: relativeKey,
                thumbnailUrl: relativeThumbKey,
                altText: img.altText || null,
                sortOrder: img.sortOrder ?? i,
                isPrimary: img.isPrimary ?? false,
                variantId,
              });
          }
        }
      }

      // Fetch final state of variants
      const finalVariants = await tx
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.orgId, orgId), eq(productVariants.productId, id), isNull(productVariants.deletedAt)))
        .orderBy(productVariants.sortOrder);

      // Fetch final state of images
      const finalImages = await tx
        .select()
        .from(productImages)
        .where(and(eq(productImages.orgId, orgId), eq(productImages.productId, id)))
        .orderBy(productImages.sortOrder);

      const mappedImages = finalImages.map((img) => ({
        ...img,
        url: getS3PublicUrl(img.url),
        thumbnailUrl: img.thumbnailUrl ? getS3PublicUrl(img.thumbnailUrl) : getS3PublicUrl(img.url),
      }));

      return {
        ...product,
        variants: finalVariants,
        images: mappedImages,
      };
    });
  },

  /**
   * Soft-delete product and its variants.
   */
  async deleteProduct(orgId: string, id: string) {
    await this.getProductById(orgId, id);

    await db.transaction(async (tx) => {
      // Soft-delete main product
      await tx
        .update(products)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(products.orgId, orgId), eq(products.id, id)));

      // Soft-delete all child variants
      await tx
        .update(productVariants)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(productVariants.orgId, orgId), eq(productVariants.productId, id)));
    });
  },

  /**
   * Internal helper to retrieve all descendant category IDs recursively.
   */
  async getDescendantCategoryIds(orgId: string, parentId: string): Promise<string[]> {
    const allCategories = await db
      .select({ id: categories.id, parentId: categories.parentId })
      .from(categories)
      .where(and(eq(categories.orgId, orgId), isNull(categories.deletedAt)));

    const descendantIds: string[] = [];
    const traverse = (currentId: string) => {
      allCategories.forEach((cat) => {
        if (cat.parentId === currentId) {
          descendantIds.push(cat.id);
          traverse(cat.id);
        }
      });
    };

    traverse(parentId);
    return descendantIds;
  },

  /**
   * Internal helper to resolve organization ID by slug.
   */
  async getOrgIdBySlug(slug: string): Promise<string> {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!org) {
      throw ApiError.notFound('Organization not found');
    }
    return org.id;
  },

  /**
   * List products publicly (only active products, by org slug).
   */
  async listPublicProducts(orgSlug: string, filters: any) {
    const orgId = await this.getOrgIdBySlug(orgSlug);
    const result = await this.listProducts(orgId, {
      ...filters,
      status: 'active',
    });

    // Sanitize sensitive data from the public API
    const sanitizedData = result.data.map((product) => {
      const {
        valuationCost,
        marginPct,
        discountPct,
        listPrice,
        preferredSupplierId,
        hsnCode,
        hsnDescription,
        taxRateId,
        hsnCodeId,
        ...safeProduct
      } = product as any;
      
      // Also sanitize variants if flattenVariants was true or variants are included
      let sanitizedVariants = undefined;
      if (safeProduct.variants) {
         sanitizedVariants = safeProduct.variants.map((v: any) => {
            const { valuationCost, marginPct, discountPct, listPrice, ...safeVariant } = v;
            return safeVariant;
         });
      }

      return {
        ...safeProduct,
        ...(sanitizedVariants ? { variants: sanitizedVariants } : {})
      };
    });

    return {
      data: sanitizedData,
      pagination: result.pagination,
    };
  },

  /**
   * Generates a luxury editorial portrait PDF catalog and streams it to the response.
   * Tailored for high readability, responsive variant matrix grids, and multinational presentation.
   */
  async generateCatalogPdfStream(orgSlug: string, filters: { categoryId?: string; brandId?: string }, res: any) {
    const orgId = await this.getOrgIdBySlug(orgSlug);
    const org = await this.getPublicOrganization(orgSlug);

    const result = await this.listProducts(orgId, {
      ...filters,
      status: 'active',
      limit: 10000,
    });

    const productsList = result.data;

    // Sort: Category → Brand → Name
    productsList.sort((a: any, b: any) => {
      const catA = (a.categoryName || 'General Products').trim().toLowerCase();
      const catB = (b.categoryName || 'General Products').trim().toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB, undefined, { numeric: true, sensitivity: 'base' });
      const brandA = (a.brandName || '').trim().toLowerCase();
      const brandB = (b.brandName || '').trim().toLowerCase();
      if (brandA !== brandB) return brandA.localeCompare(brandB, undefined, { numeric: true, sensitivity: 'base' });
      return (a.name || '').trim().toLowerCase().localeCompare((b.name || '').trim().toLowerCase(), undefined, { numeric: true, sensitivity: 'base' });
    });

    // --- Helper: fetch image buffer ---
    const fetchImageBuffer = async (url: string): Promise<Buffer | null> => {
      try {
        const imageRes = await fetch(url);
        if (imageRes.ok) return Buffer.from(await imageRes.arrayBuffer());
      } catch (e) {}
      return null;
    };

    // --- Helper: format price ---
    const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // --- Helper: fit text (reduce font size if text too long) ---
    const fitText = (doc: PDFKit.PDFDocument, text: string, maxWidth: number, startSize: number, minSize: number = 6.5): number => {
      let size = startSize;
      while (size > minSize) {
        const w = doc.fontSize(size).widthOfString(text);
        if (w <= maxWidth) break;
        size -= 0.5;
      }
      return size;
    };

    // --- Luxury Editorial Color Palette ---
    const C = {
      dark: '#18181b',       // Zinc 900
      darkMuted: '#27272a',  // Zinc 800
      text: '#27272a',       // Zinc 800
      muted: '#71717a',      // Zinc 500
      subtle: '#a1a1aa',     // Zinc 400
      accent: '#d97706',     // Amber 600
      accentDark: '#92400e', // Amber 800
      accentLight: '#fef3c7',// Amber 100
      accentSoft: '#fffbeb', // Amber 50
      white: '#ffffff',
      border: '#e4e4e7',     // Zinc 200
      borderLight: '#f4f4f5',// Zinc 100
      bgAlt: '#fafafa',      // Zinc 50
      bgCard: '#f4f4f5',     // Zinc 100
      zebraA: '#ffffff',
      zebraB: '#fcfcfc',
    };

    // Fetch org logo
    let logoBuffer: Buffer | null = null;
    if (org.logoUrl) {
      logoBuffer = await fetchImageBuffer(org.logoUrl);
    }

    // Initialize PDFDocument in PORTRAIT mode
    const doc = new PDFDocument({ margin: 28, size: 'A4', bufferPages: true });
    doc.pipe(res);

    const pageW = doc.page.width;   // ~595.28 pt
    const pageH = doc.page.height;  // ~841.89 pt
    const margin = 28;
    const contentW = pageW - margin * 2; // ~539.28 pt

    let isCoverPage = true;

    // --- Subtle luxury background watermark ---
    const drawWatermark = () => {
      try {
        const watermarkPath = path.join(process.cwd(), 'src', 'assets', 'catalog_watermark.jpg');
        if (fs.existsSync(watermarkPath)) {
          doc.save();
          doc.fillOpacity(0.025);
          doc.image(watermarkPath, 0, 0, { width: pageW, height: pageH });
          doc.restore();
          doc.fillOpacity(1);
        }
      } catch (e) {}
    };

    // --- Running Header for Portrait Content Pages ---
    const drawPageHeader = () => {
      // Top minimal bar
      doc.rect(0, 0, pageW, 34).fill(C.white);
      doc.rect(0, 33, pageW, 1).fill(C.border);
      doc.rect(margin, 33, 36, 1).fill(C.accent);

      // Org name left
      doc.fillColor(C.dark).fontSize(9).font('Helvetica-Bold');
      doc.text(org.name.toUpperCase(), margin, 12);

      // Category / Section label right
      doc.fillColor(C.muted).fontSize(7.5).font('Helvetica');
      doc.text('OFFICIAL PRODUCT CATALOG', pageW - margin - 180, 13, { width: 180, align: 'right' });
    };

    doc.on('pageAdded', () => {
      if (!isCoverPage) {
        drawWatermark();
        drawPageHeader();
      }
    });

    // =========================================================================
    // FRONT COVER PAGE (PORTRAIT EDITORIAL DESIGN)
    // =========================================================================
    try {
      const coverImagePath = path.join(process.cwd(), 'src', 'assets', 'catalog_wardrobe_cover.jpg');
      if (fs.existsSync(coverImagePath)) {
        doc.image(coverImagePath, 0, 0, { width: pageW, height: pageH });
      }
    } catch (e) {}

    // Dark luxury gradient overlay from top to bottom
    const gradientSteps = 50;
    for (let i = 0; i < gradientSteps; i++) {
      const opacity = Math.min(0.92, 0.25 + (i / gradientSteps) * 0.70);
      const yPos = pageH * 0.35 + (pageH * 0.65 * i) / gradientSteps;
      const h = (pageH * 0.65) / gradientSteps + 1;
      doc.save();
      doc.fillOpacity(opacity);
      doc.rect(0, yPos, pageW, h).fill('#09090b');
      doc.restore();
    }
    doc.fillOpacity(1);

    // Cover Outer Gold Border Frame
    doc.rect(20, 20, pageW - 40, pageH - 40).strokeColor(C.accent).lineWidth(1).stroke();

    // Cover Logo
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, pageW / 2 - 38, pageH * 0.42, { fit: [76, 76], align: 'center', valign: 'center' });
      } catch (e) {}
    }

    // Company Name
    const orgNameSize = fitText(doc, org.name.toUpperCase(), pageW - 80, 32, 20);
    doc.fillColor(C.white).fontSize(orgNameSize).font('Helvetica-Bold');
    doc.text(org.name.toUpperCase(), 40, pageH * 0.55, { width: pageW - 80, align: 'center' });

    // Gold Accent Center Line
    doc.rect(pageW / 2 - 40, pageH * 0.55 + 46, 80, 2).fill(C.accent);

    // Subtitle
    doc.fillColor(C.accent).fontSize(13).font('Helvetica-Bold');
    doc.text('PRODUCT CATALOG & SPECIFICATIONS', 0, pageH * 0.55 + 56, { width: pageW, align: 'center' });

    doc.fillColor('#d4d4d8').fontSize(9).font('Helvetica');
    const editionYear = new Date().getFullYear();
    doc.text(`COLLECTION ${editionYear} — ${editionYear + 1}`, 0, pageH * 0.55 + 74, { width: pageW, align: 'center' });

    // Contact info footer on cover
    const contactParts: string[] = [];
    if (org.phone) contactParts.push(org.phone);
    if (org.email) contactParts.push(org.email);
    if (org.website) contactParts.push(org.website);
    if (contactParts.length > 0) {
      doc.fillColor('#a1a1aa').fontSize(8).font('Helvetica');
      doc.text(contactParts.join('  •  '), 30, pageH - 52, { width: pageW - 60, align: 'center' });
    }

    isCoverPage = false;

    // =========================================================================
    // CONTENT PAGES (PORTRAIT)
    // =========================================================================
    let y = 0;
    let itemIdx = 1;

    // Group products by category
    const categoryMap = new Map<string, any[]>();
    for (const product of productsList) {
      if (!product) continue;
      const catName = product.categoryName || 'General Products';
      if (!categoryMap.has(catName)) categoryMap.set(catName, []);
      categoryMap.get(catName)!.push(product);
    }

    let catIdx = 0;
    for (const [catName, catProducts] of categoryMap.entries()) {
      // Start each major category on a fresh page
      doc.addPage();
      y = 44;

      // ---- Luxury Category Banner ----
      doc.roundedRect(margin, y, contentW, 28, 4).fill(C.dark);
      doc.rect(margin, y, 4, 28).fill(C.accent);
      doc.fillColor(C.white).fontSize(10.5).font('Helvetica-Bold');
      doc.text(catName.toUpperCase(), margin + 14, y + 8);
      doc.fillColor(C.accent).fontSize(8).font('Helvetica-Bold');
      doc.text(`${catProducts.length} Product${catProducts.length > 1 ? 's' : ''}`, pageW - margin - 100, y + 9, { width: 90, align: 'right' });
      y += 36;

      for (const product of catProducts) {
        const variants = Array.isArray((product as any).variants) ? (product as any).variants : [];

        // Fetch image
        let imageBuffer: Buffer | null = null;
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
          const primaryImage = product.images.find((img: any) => img.isPrimary) || product.images[0];
          if (primaryImage?.url) imageBuffer = await fetchImageBuffer(primaryImage.url);
        }

        if (variants.length === 0) {
          // ===========================================================
          // SINGLE PRODUCT (PORTRAIT CARD LAYOUT)
          // ===========================================================
          const cardH = 96;
          const imageBoxSize = 82;
          const detailsX = margin + imageBoxSize + 14;
          const detailsW = contentW - imageBoxSize - 14;

          if (y + cardH + 12 > pageH - 42) {
            doc.addPage();
            y = 44;
          }

          // Card Background Frame
          doc.roundedRect(margin, y, contentW, cardH, 6).fillAndStroke(C.white, C.border);

          // Image Box
          doc.roundedRect(margin + 7, y + 7, imageBoxSize, imageBoxSize, 4).fillAndStroke(C.bgAlt, C.borderLight);
          if (imageBuffer) {
            try {
              doc.image(imageBuffer, margin + 9, y + 9, { fit: [imageBoxSize - 4, imageBoxSize - 4], align: 'center', valign: 'center' });
            } catch (e) {
              doc.fillColor(C.subtle).fontSize(22).font('Helvetica-Bold');
              doc.text(product.name.slice(0, 2).toUpperCase(), margin + 7, y + 30, { width: imageBoxSize, align: 'center' });
            }
          } else {
            doc.fillColor(C.subtle).fontSize(22).font('Helvetica-Bold');
            doc.text(product.name.slice(0, 2).toUpperCase(), margin + 7, y + 30, { width: imageBoxSize, align: 'center' });
          }

          // Product Name (Adaptive)
          const nameFontSize = fitText(doc, `${itemIdx}. ${product.name}`, detailsW - 130, 11, 8.5);
          doc.fillColor(C.dark).fontSize(nameFontSize).font('Helvetica-Bold');
          doc.text(`${itemIdx}. ${product.name}`, detailsX, y + 10, { width: detailsW - 130 });

          // Brand Badge + SKU
          let metaY = y + 28;
          if (product.brandName) {
            const brandText = product.brandName;
            const badgeW = doc.fontSize(7).font('Helvetica-Bold').widthOfString(brandText) + 12;
            doc.roundedRect(detailsX, metaY, badgeW, 14, 3).fill(C.bgCard);
            doc.fillColor(C.muted).fontSize(7).font('Helvetica-Bold');
            doc.text(brandText, detailsX + 6, metaY + 3);
            metaY += 18;
          }

          if (product.sku) {
            doc.fillColor(C.subtle).fontSize(7.5).font('Helvetica');
            doc.text(`SKU: ${product.sku}`, detailsX, metaY);
          }

          // Packing Info
          const uom = product.uomCode || 'pcs';
          const boxQty = (product as any).boxQuantity || 1;
          doc.fillColor(C.muted).fontSize(7.5).font('Helvetica');
          doc.text(`Packing: ${boxQty} ${uom}/box`, detailsX, y + cardH - 18);

          // Price Tag Block (Right Aligned)
          const price = Number(product.mrp || 0);
          const priceStr = formatPrice(price);
          doc.fillColor(C.accentDark).fontSize(13).font('Helvetica-Bold');
          doc.text(priceStr, pageW - margin - 135, y + 12, { width: 125, align: 'right' });
          doc.fillColor(C.muted).fontSize(7.5).font('Helvetica');
          doc.text(`MRP (incl. taxes)`, pageW - margin - 135, y + 29, { width: 125, align: 'right' });

          y += cardH + 10;
          itemIdx++;

        } else {
          // ===========================================================
          // VARIANT PRODUCT (PORTRAIT RESPONSIVE MATRIX GRID)
          // ===========================================================
          const sizeSet = new Set<string>();
          const finishDataMap = new Map<string, Map<string, { price: number; boxQty: number; uom: string }>>();
          const defaultUom = product.uomCode || 'pcs';
          const defaultBoxQty = product.boxQuantity || 1;

          for (const v of variants) {
            const attrs = { ...(v.attributes || {}) };
            let sizeVal = '';
            let finishVal = '';
            const otherAttrs: Record<string, string> = {};

            Object.entries(attrs).forEach(([key, val]) => {
              const kLower = key.toLowerCase();
              if (!sizeVal && (kLower === 'size' || kLower === 'length' || kLower === 'dimension' || kLower === 'height' || kLower === 'width')) {
                sizeVal = String(val);
              } else if (!finishVal && (kLower === 'finish' || kLower === 'color' || kLower === 'coating' || kLower === 'material')) {
                finishVal = String(val);
              } else {
                otherAttrs[key] = String(val);
              }
            });

            if (!sizeVal && Object.keys(otherAttrs).length > 0) {
              const firstKey = Object.keys(otherAttrs)[0];
              sizeVal = `${firstKey}: ${otherAttrs[firstKey]}`;
              delete otherAttrs[firstKey];
            }
            if (!finishVal && Object.keys(otherAttrs).length > 0) {
              finishVal = Object.entries(otherAttrs).map(([k, val]) => `${k}: ${val}`).join(', ');
            }

            const size = sizeVal || 'Standard';
            const finish = finishVal || 'Standard';
            sizeSet.add(size);
            if (!finishDataMap.has(finish)) finishDataMap.set(finish, new Map());
            finishDataMap.get(finish)!.set(size, { price: Number(v.mrp || 0), boxQty: v.boxQuantity || defaultBoxQty || 1, uom: defaultUom });
          }

          const sortedSizes = Array.from(sizeSet).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
          );

          // Group finishes with identical pricing
          const signatureToFinishes = new Map<string, { finishes: string[]; data: Map<string, { price: number; boxQty: number; uom: string }> }>();
          for (const [finishName, sizeMap] of finishDataMap.entries()) {
            const signature = sortedSizes.map(s => { const item = sizeMap.get(s); return item ? `${s}:${item.price}:${item.boxQty}` : `${s}:null`; }).join('|');
            if (!signatureToFinishes.has(signature)) {
              signatureToFinishes.set(signature, { finishes: [finishName], data: sizeMap });
            } else {
              signatureToFinishes.get(signature)!.finishes.push(finishName);
            }
          }

          // In Portrait Mode (539pt width), split sizes into chunks of max 5 columns for pristine readability
          const MAX_COLUMNS_PORTRAIT = 5;
          const sizeChunks: string[][] = [];
          if (sortedSizes.length > MAX_COLUMNS_PORTRAIT) {
            for (let i = 0; i < sortedSizes.length; i += MAX_COLUMNS_PORTRAIT) {
              sizeChunks.push(sortedSizes.slice(i, i + MAX_COLUMNS_PORTRAIT));
            }
          } else {
            sizeChunks.push(sortedSizes);
          }

          const numFinishGroups = signatureToFinishes.size;
          const thumbSize = 58;

          sizeChunks.forEach((chunkSizes, chunkIdx) => {
            const groupsList = Array.from(signatureToFinishes.values());

            // Check shared packing
            let hasSamePacking = true;
            let firstPackingSig = '';
            for (const group of groupsList) {
              const currentSig = chunkSizes.map(s => { const item = group.data.get(s); return item ? `${item.boxQty} ${item.uom}` : '-'; }).join('|');
              if (!firstPackingSig) firstPackingSig = currentSig;
              else if (firstPackingSig !== currentSig) { hasSamePacking = false; break; }
            }

            const rowsPerFinish = hasSamePacking ? 2 : 3;
            const extraSharedPackingRow = hasSamePacking ? 1 : 0;
            const tableH = 20 + (numFinishGroups * rowsPerFinish + extraSharedPackingRow) * 18;
            const headerH = chunkIdx === 0 ? thumbSize + 8 : 18;
            const blockH = headerH + tableH + 14;

            if (y + blockH > pageH - 42) {
              doc.addPage();
              y = 44;
            }

            // Top Product Header with Image Thumbnail (for chunk 0)
            if (chunkIdx === 0) {
              // Thumbnail Box
              doc.roundedRect(margin, y, thumbSize, thumbSize, 4).fillAndStroke(C.bgAlt, C.border);
              if (imageBuffer) {
                try {
                  doc.image(imageBuffer, margin + 4, y + 4, { fit: [thumbSize - 8, thumbSize - 8], align: 'center', valign: 'center' });
                } catch (e) {
                  doc.fillColor(C.subtle).fontSize(16).font('Helvetica-Bold');
                  doc.text(product.name.slice(0, 2).toUpperCase(), margin, y + 20, { width: thumbSize, align: 'center' });
                }
              } else {
                doc.fillColor(C.subtle).fontSize(16).font('Helvetica-Bold');
                doc.text(product.name.slice(0, 2).toUpperCase(), margin, y + 20, { width: thumbSize, align: 'center' });
              }

              // Details beside thumbnail
              const infoX = margin + thumbSize + 12;
              const infoW = contentW - thumbSize - 12;

              const nameFontSize = fitText(doc, `${itemIdx}. ${product.name}`, infoW, 11, 8.5);
              doc.fillColor(C.dark).fontSize(nameFontSize).font('Helvetica-Bold');
              doc.text(`${itemIdx}. ${product.name}`, infoX, y + 4, { width: infoW });

              const brandStr = product.brandName ? `${product.brandName}` : '';
              const skuStr = product.sku ? `SKU: ${product.sku}` : '';
              const subParts = [brandStr, skuStr].filter(Boolean).join('  •  ');
              if (subParts) {
                doc.fillColor(C.muted).fontSize(7.5).font('Helvetica');
                doc.text(subParts, infoX, y + 22);
              }

              doc.fillColor(C.accentDark).fontSize(7.5).font('Helvetica-Bold');
              doc.text(`Variant Matrix Specifications`, infoX, y + 38);

              var tableTopY = y + thumbSize + 8;
            } else {
              doc.fillColor(C.muted).fontSize(8).font('Helvetica-Bold');
              doc.text(`${product.name} (Continued — Part ${chunkIdx + 1})`, margin, y);
              var tableTopY = y + 16;
            }

            // Grid Table Column Widths
            const col1W = Math.max(90, Math.min(130, contentW * 0.25));
            const sizeAreaW = contentW - col1W;
            const sizeColW = sizeAreaW / Math.max(1, chunkSizes.length);

            // Table Header (Sizes on Columns)
            doc.roundedRect(margin, tableTopY, contentW, 20, 3).fill(C.dark);
            doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold');
            doc.text('FINISH / SIZE', margin + 6, tableTopY + 6, { width: col1W - 8, align: 'left' });

            chunkSizes.forEach((size, idx) => {
              const sizeX = margin + col1W + idx * sizeColW;
              const sizeFontSize = fitText(doc, size, sizeColW - 4, 7.5, 5.5);
              doc.fillColor(C.white).fontSize(sizeFontSize).font('Helvetica-Bold');
              doc.text(size, sizeX + 2, tableTopY + 6, { width: sizeColW - 4, align: 'center' });
            });

            let curY = tableTopY + 20;

            // Finish Group Rows
            for (const group of groupsList) {
              const finishLabel = group.finishes.filter(f => f && f !== 'Standard').join(' / ') || 'Standard Finish';
              const cleanFinishLabel = finishLabel.replace(/^finish:\s*/i, '').trim();
              const sizeMap = group.data;

              // Finish Header Row (Centered with Gold Accent)
              doc.rect(margin, curY, contentW, 18).fill(C.accentLight);
              doc.rect(margin, curY, 3, 18).fill(C.accent);
              doc.rect(margin, curY, contentW, 18).strokeColor(C.border).lineWidth(0.5).stroke();
              doc.fillColor(C.accentDark).fontSize(7.5).font('Helvetica-Bold');
              doc.text(cleanFinishLabel.toUpperCase(), margin + 8, curY + 4, { width: contentW - 16, align: 'center' });
              curY += 18;

              // Rate Row
              doc.rect(margin, curY, contentW, 18).fill(C.white);
              doc.rect(margin, curY, contentW, 18).strokeColor(C.border).lineWidth(0.5).stroke();
              doc.fillColor(C.muted).fontSize(7).font('Helvetica-Bold');
              doc.text('Rate', margin + 6, curY + 5, { width: col1W - 8, align: 'left' });

              chunkSizes.forEach((size, idx) => {
                const sizeX = margin + col1W + idx * sizeColW;
                doc.moveTo(sizeX, curY).lineTo(sizeX, curY + 18).strokeColor(C.border).lineWidth(0.5).stroke();
                const item = sizeMap.get(size);
                const rateText = item ? formatPrice(item.price) : '—';
                const rateFontSize = fitText(doc, rateText, sizeColW - 4, 8, 6);
                doc.fillColor(C.dark).fontSize(rateFontSize).font('Helvetica-Bold');
                doc.text(rateText, sizeX + 2, curY + 5, { width: sizeColW - 4, align: 'center' });
              });
              curY += 18;

              // Per-finish packing row (if not shared)
              if (!hasSamePacking) {
                doc.rect(margin, curY, contentW, 18).fill(C.bgAlt);
                doc.rect(margin, curY, contentW, 18).strokeColor(C.border).lineWidth(0.5).stroke();
                doc.fillColor(C.subtle).fontSize(6.5).font('Helvetica-Oblique');
                doc.text('Packing', margin + 6, curY + 5, { width: col1W - 8, align: 'left' });

                chunkSizes.forEach((size, idx) => {
                  const sizeX = margin + col1W + idx * sizeColW;
                  doc.moveTo(sizeX, curY).lineTo(sizeX, curY + 18).strokeColor(C.border).lineWidth(0.5).stroke();
                  const item = sizeMap.get(size);
                  const packingText = item ? `${item.boxQty} ${item.uom}` : '—';
                  doc.fillColor(C.muted).fontSize(6.5).font('Helvetica');
                  doc.text(packingText, sizeX + 2, curY + 5, { width: sizeColW - 4, align: 'center' });
                });
                curY += 18;
              }
            }

            // Shared packing row
            if (hasSamePacking && groupsList.length > 0) {
              const firstGroup = groupsList[0];
              doc.rect(margin, curY, contentW, 18).fill(C.bgAlt);
              doc.rect(margin, curY, contentW, 18).strokeColor(C.border).lineWidth(0.5).stroke();
              doc.fillColor(C.subtle).fontSize(6.5).font('Helvetica-Oblique');
              doc.text('Packing', margin + 6, curY + 5, { width: col1W - 8, align: 'left' });

              chunkSizes.forEach((size, idx) => {
                const sizeX = margin + col1W + idx * sizeColW;
                doc.moveTo(sizeX, curY).lineTo(sizeX, curY + 18).strokeColor(C.border).lineWidth(0.5).stroke();
                const item = firstGroup.data.get(size);
                const packingText = item ? `${item.boxQty} ${item.uom}` : '—';
                doc.fillColor(C.muted).fontSize(6.5).font('Helvetica');
                doc.text(packingText, sizeX + 2, curY + 5, { width: sizeColW - 4, align: 'center' });
              });
              curY += 18;
            }

            y = curY + 14;
          });

          itemIdx++;
        }

        // Soft divider line between products
        if (y < pageH - 45) {
          doc.save();
          doc.strokeColor(C.border).lineWidth(0.5);
          doc.moveTo(margin + 10, y - 4).lineTo(pageW - margin - 10, y - 4).dash(3, { space: 3 }).stroke();
          doc.undash();
          doc.restore();
        }
      }

      catIdx++;
    }

    // =========================================================================
    // BACK COVER PAGE (PORTRAIT EDITORIAL DESIGN)
    // =========================================================================
    isCoverPage = true;
    doc.addPage();

    // Dark luxury background
    doc.rect(0, 0, pageW, pageH).fill(C.dark);

    // Decorative frame
    doc.rect(20, 20, pageW - 40, pageH - 40).strokeColor(C.accent).lineWidth(1).stroke();

    // Logo
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, pageW / 2 - 32, pageH * 0.28, { fit: [64, 64], align: 'center', valign: 'center' });
      } catch (e) {}
    }

    // Thank You Title
    doc.fillColor(C.white).fontSize(28).font('Helvetica-Bold');
    doc.text('Thank You', 0, pageH * 0.44, { width: pageW, align: 'center' });

    doc.rect(pageW / 2 - 30, pageH * 0.44 + 38, 60, 2).fill(C.accent);

    doc.fillColor('#d4d4d8').fontSize(10.5).font('Helvetica');
    doc.text('For exploring our architectural product collection.', 0, pageH * 0.44 + 48, { width: pageW, align: 'center' });

    // Contact & Address section
    const addressParts: string[] = [];
    if (org.addressLine1) addressParts.push(org.addressLine1);
    if (org.city) addressParts.push(org.city);
    if (org.stateName) addressParts.push(org.stateName);
    if (org.pincode) addressParts.push(org.pincode);
    const fullAddress = addressParts.join(', ');

    let footerY = pageH * 0.65;
    if (fullAddress) {
      doc.fillColor(C.accent).fontSize(8.5).font('Helvetica-Bold');
      doc.text('HEADQUARTERS', 0, footerY, { width: pageW, align: 'center' });
      doc.fillColor('#a1a1aa').fontSize(8.5).font('Helvetica');
      doc.text(fullAddress, 40, footerY + 14, { width: pageW - 80, align: 'center' });
      footerY += 40;
    }

    if (contactParts.length > 0) {
      doc.fillColor(C.accent).fontSize(8.5).font('Helvetica-Bold');
      doc.text('CONNECT WITH US', 0, footerY, { width: pageW, align: 'center' });
      doc.fillColor('#a1a1aa').fontSize(8.5).font('Helvetica');
      doc.text(contactParts.join('   |   '), 40, footerY + 14, { width: pageW - 80, align: 'center' });
    }

    // Page numbers (bufferedPageRange) — safely render inside margins without auto page overflow
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      if (i === 0 || i === totalPages - 1) continue; // Skip front and back covers
      
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor(C.subtle).fontSize(7.5).font('Helvetica');
      doc.text(`Page ${i} of ${totalPages - 2}`, pageW - margin - 120, pageH - 22, { width: 120, align: 'right', lineBreak: false });
      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  },

  /**
   * Generates a professionally designed PDF Price List and streams it to the response.
   * Clean tabular layout with zebra striping, dynamic sizing, and page numbering.
   */
  async generatePriceListPdfStream(orgSlug: string, filters: { categoryId?: string; brandId?: string }, res: any) {
    const orgId = await this.getOrgIdBySlug(orgSlug);
    const org = await this.getPublicOrganization(orgSlug);

    const result = await this.listProducts(orgId, {
      ...filters,
      status: 'active',
      limit: 10000,
    });

    const productsList = result.data;

    // Sort: Category → Brand → Name
    productsList.sort((a: any, b: any) => {
      const catA = (a.categoryName || 'General Products').trim().toLowerCase();
      const catB = (b.categoryName || 'General Products').trim().toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB, undefined, { numeric: true, sensitivity: 'base' });
      const brandA = (a.brandName || '').trim().toLowerCase();
      const brandB = (b.brandName || '').trim().toLowerCase();
      if (brandA !== brandB) return brandA.localeCompare(brandB, undefined, { numeric: true, sensitivity: 'base' });
      return (a.name || '').trim().toLowerCase().localeCompare((b.name || '').trim().toLowerCase(), undefined, { numeric: true, sensitivity: 'base' });
    });

    // --- Helper: fetch image buffer ---
    const fetchImageBuffer = async (url: string): Promise<Buffer | null> => {
      try {
        const imageRes = await fetch(url);
        if (imageRes.ok) return Buffer.from(await imageRes.arrayBuffer());
      } catch (e) {}
      return null;
    };

    // --- Helper: format price ---
    const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // --- Helper: fit text ---
    const fitText = (doc: PDFKit.PDFDocument, text: string, maxWidth: number, startSize: number, minSize: number = 7): number => {
      let size = startSize;
      while (size > minSize) {
        const w = doc.fontSize(size).widthOfString(text);
        if (w <= maxWidth) break;
        size -= 0.5;
      }
      return size;
    };

    // --- Color palette ---
    const C = {
      dark: '#1c1917',
      text: '#292524',
      muted: '#78716c',
      subtle: '#a8a29e',
      accent: '#d97706',
      accentDark: '#b45309',
      accentLight: '#fef3c7',
      white: '#ffffff',
      border: '#e7e5e4',
      bgAlt: '#f9fafb',
      bgCard: '#f5f5f4',
      zebraA: '#ffffff',
      zebraB: '#fafaf9',
    };

    // Fetch org logo
    let logoBuffer: Buffer | null = null;
    if (org.logoUrl) {
      logoBuffer = await fetchImageBuffer(org.logoUrl);
    }

    // Initialize PDFDocument — Portrait A4
    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    doc.pipe(res);

    const pageW = doc.page.width;   // ~595.28
    const pageH = doc.page.height;  // ~841.89
    const margin = 30;
    const contentW = pageW - margin * 2;

    // --- Subtle watermark ---
    const drawWatermark = () => {
      try {
        const watermarkPath = path.join(process.cwd(), 'src', 'assets', 'catalog_watermark.jpg');
        if (fs.existsSync(watermarkPath)) {
          doc.save();
          doc.fillOpacity(0.03);
          doc.image(watermarkPath, 0, 0, { width: pageW, height: pageH });
          doc.restore();
          doc.fillOpacity(1);
        }
      } catch (e) {}
    };

    let isFirstPage = true;

    // --- Page header for pages 2+ ---
    const drawSecondaryHeader = () => {
      doc.rect(0, 0, pageW, 32).fill(C.white);
      doc.rect(0, 31, pageW, 1).fill(C.accent);

      doc.fillColor(C.dark).fontSize(9).font('Helvetica-Bold');
      doc.text(org.name.toUpperCase(), margin, 10);
      doc.fillColor(C.muted).fontSize(8).font('Helvetica');
      doc.text('PRICE LIST', pageW / 2 - 40, 11, { width: 80, align: 'center' });
    };

    // --- Footer (every page via bufferedPages) ---
    const drawFooter = (pageNum: number, totalPages: number) => {
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      doc.strokeColor(C.border).lineWidth(0.5);
      doc.moveTo(margin, pageH - 28).lineTo(pageW - margin, pageH - 28).stroke();

      doc.fillColor(C.subtle).fontSize(7).font('Helvetica');
      doc.text('* Prices subject to change without notice. This is a system-generated document.', margin, pageH - 22, { width: contentW * 0.7, lineBreak: false });
      doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin - 80, pageH - 22, { width: 80, align: 'right', lineBreak: false });

      doc.page.margins.bottom = oldBottom;
    };

    doc.on('pageAdded', () => {
      drawWatermark();
      if (!isFirstPage) {
        drawSecondaryHeader();
      }
    });

    // =========================================================================
    // PAGE 1 — Header
    // =========================================================================
    drawWatermark();

    let y = 30;

    // Logo + Org Name header
    let headerTextX = margin;
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, margin, y, { fit: [50, 50], align: 'center', valign: 'center' });
        headerTextX = margin + 60;
      } catch (e) {}
    }

    doc.fillColor(C.dark).fontSize(20).font('Helvetica-Bold');
    doc.text(org.name, headerTextX, y + 4, { width: contentW - 60 });
    doc.fillColor(C.accent).fontSize(11).font('Helvetica-Bold');
    doc.text('PRICE LIST & PACKING GUIDE', headerTextX, y + 30);

    y = Math.max(y + 55, y + (logoBuffer ? 58 : 48));

    // Date
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.fillColor(C.muted).fontSize(8).font('Helvetica');
    doc.text(`Generated: ${dateStr}`, margin, y);
    y += 16;

    // Double-line separator
    doc.strokeColor(C.dark).lineWidth(1.5);
    doc.moveTo(margin, y).lineTo(pageW - margin, y).stroke();
    doc.strokeColor(C.border).lineWidth(0.5);
    doc.moveTo(margin, y + 3).lineTo(pageW - margin, y + 3).stroke();
    y += 12;

    isFirstPage = false;

    // =========================================================================
    // TABLE LAYOUT
    // =========================================================================
    const colX = {
      srNo: margin,
      item: margin + 28,
      brand: margin + 230,
      packing: margin + 320,
      price: pageW - margin - 80,
    };
    const colW = {
      srNo: 26,
      item: 200,
      brand: 88,
      packing: pageW - margin - 80 - (margin + 320),
      price: 80,
    };

    // Table column header
    const drawTableHeader = () => {
      doc.rect(margin, y, contentW, 20).fill(C.dark);
      doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold');
      doc.text('SR', colX.srNo + 4, y + 6, { width: colW.srNo });
      doc.text('PRODUCT', colX.item, y + 6, { width: colW.item });
      doc.text('BRAND', colX.brand, y + 6, { width: colW.brand });
      doc.text('PACKING', colX.packing, y + 6, { width: colW.packing });
      doc.text('RATE (₹)', colX.price, y + 6, { width: colW.price, align: 'right' });
      y += 20;
    };

    let itemIdx = 1;

    // Group by category
    const categoryMap = new Map<string, any[]>();
    for (const product of productsList) {
      if (!product) continue;
      const catName = product.categoryName || 'General Products';
      if (!categoryMap.has(catName)) categoryMap.set(catName, []);
      categoryMap.get(catName)!.push(product);
    }

    let catIdx = 0;
    for (const [catName, catProducts] of categoryMap.entries()) {
      if (catIdx > 0) {
        // Add spacing between categories
        if (y + 60 > pageH - 45) {
          doc.addPage();
          y = 40;
        }
        y += 8;
      }

      // ---- Category Banner ----
      if (y + 40 > pageH - 45) {
        doc.addPage();
        y = 40;
      }
      doc.rect(margin, y, contentW, 24).fill(C.accentLight);
      doc.rect(margin, y, 4, 24).fill(C.accent);
      doc.fillColor(C.accentDark).fontSize(9).font('Helvetica-Bold');
      doc.text(catName.toUpperCase(), margin + 14, y + 7);
      doc.fillColor(C.muted).fontSize(7.5).font('Helvetica');
      doc.text(`${catProducts.length} item${catProducts.length > 1 ? 's' : ''}`, pageW - margin - 80, y + 8, { width: 70, align: 'right' });
      y += 30;

      // Table column header after each category
      drawTableHeader();

      let rowInCat = 0;

      for (const product of catProducts) {
        const variants = Array.isArray((product as any).variants) ? (product as any).variants : [];

        if (variants.length === 0) {
          // ===========================================================
          // SINGLE PRODUCT ROW
          // ===========================================================
          if (y + 22 > pageH - 45) {
            doc.addPage();
            y = 40;
            drawTableHeader();
          }

          const price = Number(product.mrp || 0);
          const uom = product.uomCode || 'pcs';
          const boxQty = (product as any).boxQuantity || 1;
          const zebraColor = rowInCat % 2 === 0 ? C.zebraA : C.zebraB;

          // Zebra stripe background
          doc.rect(margin, y, contentW, 20).fill(zebraColor);
          doc.rect(margin, y + 20, contentW, 0.5).fill(C.border);

          // Sr No
          doc.fillColor(C.muted).fontSize(8).font('Helvetica');
          doc.text(`${itemIdx}`, colX.srNo + 4, y + 5, { width: colW.srNo });

          // Product name (adaptive)
          const nameFontSize = fitText(doc, product.name, colW.item - 4, 9, 7);
          doc.fillColor(C.dark).fontSize(nameFontSize).font('Helvetica-Bold');
          doc.text(product.name, colX.item, y + 5, { width: colW.item });

          // Brand
          if (product.brandName) {
            doc.fillColor(C.muted).fontSize(7.5).font('Helvetica');
            doc.text(product.brandName, colX.brand, y + 5, { width: colW.brand });
          }

          // Packing
          doc.fillColor(C.muted).fontSize(8).font('Helvetica');
          doc.text(`${boxQty} ${uom}/box`, colX.packing, y + 5, { width: colW.packing });

          // Price — right aligned, bold
          doc.fillColor(C.dark).fontSize(9).font('Helvetica-Bold');
          doc.text(formatPrice(price), colX.price, y + 5, { width: colW.price, align: 'right' });

          y += 20;
          itemIdx++;
          rowInCat++;

        } else {
          // ===========================================================
          // VARIANT PRODUCT — Grid Table
          // ===========================================================
          const sizeSet = new Set<string>();
          const finishDataMap = new Map<string, Map<string, { price: number; boxQty: number; uom: string }>>();
          const defaultUom = product.uomCode || 'pcs';
          const defaultBoxQty = product.boxQuantity || 1;

          for (const v of variants) {
            const attrs = { ...(v.attributes || {}) };
            let sizeVal = '';
            let finishVal = '';
            const otherAttrs: Record<string, string> = {};

            Object.entries(attrs).forEach(([key, val]) => {
              const kLower = key.toLowerCase();
              if (!sizeVal && (kLower === 'size' || kLower === 'length' || kLower === 'dimension' || kLower === 'height' || kLower === 'width')) {
                sizeVal = String(val);
              } else if (!finishVal && (kLower === 'finish' || kLower === 'color' || kLower === 'coating' || kLower === 'material')) {
                finishVal = String(val);
              } else {
                otherAttrs[key] = String(val);
              }
            });

            if (!sizeVal && Object.keys(otherAttrs).length > 0) {
              const firstKey = Object.keys(otherAttrs)[0];
              sizeVal = `${firstKey}: ${otherAttrs[firstKey]}`;
              delete otherAttrs[firstKey];
            }
            if (!finishVal && Object.keys(otherAttrs).length > 0) {
              finishVal = Object.entries(otherAttrs).map(([k, val]) => `${k}: ${val}`).join(', ');
            }

            const size = sizeVal || 'Standard';
            const finish = finishVal || 'Standard';
            sizeSet.add(size);
            if (!finishDataMap.has(finish)) finishDataMap.set(finish, new Map());
            finishDataMap.get(finish)!.set(size, { price: Number(v.mrp || 0), boxQty: v.boxQuantity || defaultBoxQty || 1, uom: defaultUom });
          }

          const sortedSizes = Array.from(sizeSet).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
          );

          // Group finishes with identical pricing
          const signatureToFinishes = new Map<string, { finishes: string[]; data: Map<string, { price: number; boxQty: number; uom: string }> }>();
          for (const [finishName, sizeMap] of finishDataMap.entries()) {
            const signature = sortedSizes.map(s => { const item = sizeMap.get(s); return item ? `${s}:${item.price}:${item.boxQty}` : `${s}:null`; }).join('|');
            if (!signatureToFinishes.has(signature)) {
              signatureToFinishes.set(signature, { finishes: [finishName], data: sizeMap });
            } else {
              signatureToFinishes.get(signature)!.finishes.push(finishName);
            }
          }

          const gridX = colX.item;
          const gridW = pageW - margin - gridX;
          const col1W = Math.max(90, Math.min(120, gridW * 0.22));
          const sizeAreaW = gridW - col1W;

          const MAX_COLUMNS_PER_GRID = 8;
          const sizeChunks: string[][] = [];
          if (sortedSizes.length > MAX_COLUMNS_PER_GRID) {
            const chunkSize = Math.ceil(sortedSizes.length / 2);
            for (let i = 0; i < sortedSizes.length; i += chunkSize) sizeChunks.push(sortedSizes.slice(i, i + chunkSize));
          } else {
            sizeChunks.push(sortedSizes);
          }

          const numFinishGroups = signatureToFinishes.size;

          sizeChunks.forEach((chunkSizes, chunkIdx) => {
            const numSizes = chunkSizes.length;
            const sizeColW = sizeAreaW / Math.max(1, numSizes);
            const groupsList = Array.from(signatureToFinishes.values());

            // Check shared packing
            let hasSamePacking = true;
            let firstPackingSig = '';
            for (const group of groupsList) {
              const currentSig = chunkSizes.map(s => { const item = group.data.get(s); return item ? `${item.boxQty} ${item.uom}` : '-'; }).join('|');
              if (!firstPackingSig) firstPackingSig = currentSig;
              else if (firstPackingSig !== currentSig) { hasSamePacking = false; break; }
            }

            const rowsPerFinish = hasSamePacking ? 2 : 3;
            const extraSharedPackingRow = hasSamePacking ? 1 : 0;
            const totalGridH = (chunkIdx === 0 ? 18 : 14) + 22 + (numFinishGroups * rowsPerFinish + extraSharedPackingRow) * 18 + 8;

            if (y + totalGridH > pageH - 45) {
              doc.addPage();
              y = 40;
            }

            // Product header line
            if (chunkIdx === 0) {
              doc.fillColor(C.muted).fontSize(8).font('Helvetica');
              doc.text(`${itemIdx}`, colX.srNo + 4, y + 1, { width: colW.srNo });
              const nameFontSize = fitText(doc, product.name, gridW - 10, 9.5, 7.5);
              doc.fillColor(C.dark).fontSize(nameFontSize).font('Helvetica-Bold');
              doc.text(product.name, gridX, y + 1, { width: gridW });
              y += 18;
            } else {
              doc.fillColor(C.muted).fontSize(8).font('Helvetica-Bold');
              doc.text(`${product.name} (Continued — Part ${chunkIdx + 1})`, gridX, y, { width: gridW });
              y += 14;
            }

            // Grid header row — dark
            doc.roundedRect(gridX, y, gridW, 22, 3).fill(C.dark);
            doc.fillColor(C.white).fontSize(7.5).font('Helvetica-Bold');
            doc.text('FINISH / SIZE', gridX + 6, y + 6, { width: col1W - 8, align: 'left' });

            chunkSizes.forEach((size, idx) => {
              const sizeX = gridX + col1W + idx * sizeColW;
              const sizeFontSize = fitText(doc, size, sizeColW - 6, 7.5, 5.5);
              doc.fillColor(C.white).fontSize(sizeFontSize).font('Helvetica-Bold');
              doc.text(size, sizeX + 2, y + 6, { width: sizeColW - 4, align: 'center' });
            });
            y += 22;

            // Finish group rows
            for (const group of groupsList) {
              const finishLabel = group.finishes.filter(f => f && f !== 'Standard').join(' / ') || 'Standard Finish';
              const cleanFinishLabel = finishLabel.replace(/^finish:\s*/i, '').trim();
              const sizeMap = group.data;

              // Finish header row
              doc.rect(gridX, y, gridW, 18).fill(C.accentLight);
              doc.rect(gridX, y, 3, 18).fill(C.accent);
              doc.rect(gridX, y, gridW, 18).strokeColor(C.border).lineWidth(0.5).stroke();
              doc.fillColor(C.accentDark).fontSize(7.5).font('Helvetica-Bold');
              doc.text(cleanFinishLabel.toUpperCase(), gridX + 8, y + 4, { width: gridW - 16, align: 'center' });
              y += 18;

              // Rate row
              doc.rect(gridX, y, gridW, 18).fill(C.white);
              doc.rect(gridX, y, gridW, 18).strokeColor(C.border).lineWidth(0.5).stroke();
              doc.fillColor(C.muted).fontSize(7).font('Helvetica-Bold');
              doc.text('Rate', gridX + 6, y + 4, { width: col1W - 8, align: 'left' });

              chunkSizes.forEach((size, idx) => {
                const sizeX = gridX + col1W + idx * sizeColW;
                doc.moveTo(sizeX, y).lineTo(sizeX, y + 18).strokeColor(C.border).lineWidth(0.5).stroke();
                const item = sizeMap.get(size);
                const rateText = item ? formatPrice(item.price) : '—';
                const rateFontSize = fitText(doc, rateText, sizeColW - 6, 8, 6);
                doc.fillColor(C.dark).fontSize(rateFontSize).font('Helvetica-Bold');
                doc.text(rateText, sizeX + 2, y + 4, { width: sizeColW - 4, align: 'center' });
              });
              y += 18;

              // Per-finish packing row
              if (!hasSamePacking) {
                doc.rect(gridX, y, gridW, 18).fill(C.zebraB);
                doc.rect(gridX, y, gridW, 18).strokeColor(C.border).lineWidth(0.5).stroke();
                doc.fillColor(C.subtle).fontSize(7).font('Helvetica-Oblique');
                doc.text('Packing', gridX + 6, y + 4, { width: col1W - 8, align: 'left' });

                chunkSizes.forEach((size, idx) => {
                  const sizeX = gridX + col1W + idx * sizeColW;
                  doc.moveTo(sizeX, y).lineTo(sizeX, y + 18).strokeColor(C.border).lineWidth(0.5).stroke();
                  const item = sizeMap.get(size);
                  const packingText = item ? `${item.boxQty} ${item.uom}` : '—';
                  doc.fillColor(C.muted).fontSize(7).font('Helvetica');
                  doc.text(packingText, sizeX + 2, y + 4, { width: sizeColW - 4, align: 'center' });
                });
                y += 18;
              }
            }

            // Shared packing row
            if (hasSamePacking && groupsList.length > 0) {
              const firstGroup = groupsList[0];
              doc.rect(gridX, y, gridW, 18).fill(C.zebraB);
              doc.rect(gridX, y, gridW, 18).strokeColor(C.border).lineWidth(0.5).stroke();
              doc.fillColor(C.subtle).fontSize(7).font('Helvetica-Oblique');
              doc.text('Packing', gridX + 6, y + 4, { width: col1W - 8, align: 'left' });

              chunkSizes.forEach((size, idx) => {
                const sizeX = gridX + col1W + idx * sizeColW;
                doc.moveTo(sizeX, y).lineTo(sizeX, y + 18).strokeColor(C.border).lineWidth(0.5).stroke();
                const item = firstGroup.data.get(size);
                const packingText = item ? `${item.boxQty} ${item.uom}` : '—';
                doc.fillColor(C.muted).fontSize(7).font('Helvetica');
                doc.text(packingText, sizeX + 2, y + 4, { width: sizeColW - 4, align: 'center' });
              });
              y += 18;
            }

            y += 6;
          });

          itemIdx++;
          rowInCat++;
        }

        // Divider between products
        y += 2;
        doc.strokeColor(C.border).lineWidth(0.5);
        doc.moveTo(margin, y).lineTo(pageW - margin, y).stroke();
        y += 6;
      }

      catIdx++;
    }

    // =========================================================================
    // Page numbers & footers (added using bufferedPageRange)
    // =========================================================================
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      drawFooter(i + 1, totalPages);
    }

    doc.end();
  },

  /**
   * Retrieve product details publicly by org slug and product slug.
   */
  async getPublicProductBySlug(orgSlug: string, productSlug: string) {
    const orgId = await this.getOrgIdBySlug(orgSlug);
    const [product] = await db
      .select({
        id: products.id,
        orgId: products.orgId,
        name: products.name,
        slug: products.slug,
        description: products.description,
        shortDescription: products.shortDescription,
        type: products.type,
        sku: products.sku,
        barcode: products.barcode,
        
        
        
        purchaseMode: productPricingRules.purchaseMode,
        
        
        
        mrp: products.mrp,
        uomId: products.uomId,
        hasVariants: products.hasVariants,
        isTaxable: products.isTaxable,
        trackInventory: products.trackInventory,
        boxQuantity: products.boxQuantity,
        status: products.status,
        metaTitle: products.metaTitle,
        metaDescription: products.metaDescription,
        tags: products.tags,
        attributes: products.attributes,
        categoryName: categories.name,
        brandName: brands.name,
        uomCode: unitsOfMeasurement.code,
        createdAt: products.createdAt,
        stockQuantity: sql<number>`COALESCE((
          SELECT SUM(quantity_on_hand)
          FROM inventory
          WHERE inventory.product_id = products.id AND inventory.variant_id IS NULL
        ), 0)::int`,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(unitsOfMeasurement, eq(products.uomId, unitsOfMeasurement.id))
      .leftJoin(
        productPricingRules,
        and(
          eq(products.id, productPricingRules.productId),
          isNull(productPricingRules.variantId),
          isNull(productPricingRules.priceListId)
        )
      )
      .where(
        and(
          eq(products.orgId, orgId),
          eq(products.slug, productSlug),
          eq(products.status, 'active'),
          isNull(products.deletedAt)
        )
      )
      .limit(1);

    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    const variants = await db
      .select({
        id: productVariants.id,
        orgId: productVariants.orgId,
        productId: productVariants.productId,
        sku: productVariants.sku,
        barcode: productVariants.barcode,
        name: productVariants.name,
        categoryId: productVariants.categoryId,
        categoryName: categories.name,
        attributes: productVariants.attributes,
        
        
        
        mrp: productVariants.mrp,
        
        purchaseMode: productPricingRules.purchaseMode,
        defaultPacking: productVariants.defaultPacking,
        boxQuantity: productVariants.boxQuantity,
        lowStockThreshold: productVariants.lowStockThreshold,
        isActive: productVariants.isActive,
        sortOrder: productVariants.sortOrder,
        createdAt: productVariants.createdAt,
        updatedAt: productVariants.updatedAt,
        deletedAt: productVariants.deletedAt,
        stockQuantity: sql<number>`COALESCE(SUM(${inventory.quantityOnHand}), 0)::int`,
      })
      .from(productVariants)
      .leftJoin(inventory, eq(productVariants.id, inventory.variantId))
      .leftJoin(
        productPricingRules,
        and(
          eq(productVariants.id, productPricingRules.variantId),
          isNull(productPricingRules.priceListId)
        )
      )
      .leftJoin(categories, eq(productVariants.categoryId, categories.id))
      .where(
        and(
          eq(productVariants.orgId, orgId),
          eq(productVariants.productId, product.id),
          eq(productVariants.isActive, true),
          isNull(productVariants.deletedAt)
        )
      )
      .groupBy(productVariants.id, productPricingRules.id, categories.id)
      .orderBy(productVariants.sortOrder);

    const rawImages = await db
      .select()
      .from(productImages)
      .where(and(eq(productImages.orgId, orgId), eq(productImages.productId, product.id)))
      .orderBy(productImages.sortOrder);

    const images = rawImages.map((img) => ({
      ...img,
      url: getS3PublicUrl(img.url),
      thumbnailUrl: img.thumbnailUrl ? getS3PublicUrl(img.thumbnailUrl) : getS3PublicUrl(img.url),
    }));

    // Query active promotions for this organization
    const today = new Date().toISOString().split('T')[0];
    const activePromos = await db.query.promotionalSchemes.findMany({
      where: (ps, { and, eq, lte, gte }) => and(
        eq(ps.orgId, orgId),
        eq(ps.isActive, true),
        lte(ps.validFrom, today),
        gte(ps.validTo, today)
      ),
      with: {
        items: true,
      },
      orderBy: (ps, { desc }) => [desc(ps.priority), desc(ps.createdAt)],
    });

    const findPromo = (prodId: string, catId?: string | null, brId?: string | null, varId?: string | null) => {
      for (const promo of activePromos) {
        let applies = false;
        if (promo.appliesTo === 'all_products') {
          applies = true;
        } else if (promo.appliesTo === 'specific_brands' && brId) {
          applies = promo.items?.some((it: any) => it.brandId === brId) || false;
        } else if (promo.appliesTo === 'specific_categories' && catId) {
          applies = promo.items?.some((it: any) => it.categoryId === catId) || false;
        } else if (promo.appliesTo === 'specific_products') {
          applies = promo.items?.some((it: any) => it.productId === prodId && (!it.variantId || it.variantId === varId)) || false;
        } else if (promo.appliesTo === 'specific_variants' && varId) {
          applies = promo.items?.some((it: any) => it.variantId === varId) || false;
        }
        if (applies) return promo;
      }
      return null;
    };

    const calculatePromoPrice = (basePrice: number, promo: any) => {
      if (!promo || basePrice <= 0) return null;
      let discount = 0;
      if (promo.discountType === 'percentage') {
        discount = (basePrice * Number(promo.discountValue)) / 100;
        if (promo.maxDiscountAmount && discount > Number(promo.maxDiscountAmount)) {
          discount = Number(promo.maxDiscountAmount);
        }
      } else {
        discount = Number(promo.discountValue);
      }
      const discounted = Math.max(0, basePrice - discount);
      return {
        promoPrice: (Math.round(discounted * 2) / 2).toFixed(2),
        discountAmount: discount.toFixed(2),
        badgeText: promo.badgeText || (promo.discountType === 'percentage' ? `${Number(promo.discountValue)}% OFF` : `₹${promo.discountValue} OFF`),
        schemeName: promo.name,
        promoType: promo.promoType,
      };
    };

    const productPromo = findPromo(product.id, null, null, null);

    const mappedVariants = variants.map((v) => {
      const variantImage = images.find(img => img.variantId === v.id);
      const variantPromo = findPromo(product.id, v.categoryId, null, v.id) || productPromo;
      const variantPromoCalculation = calculatePromoPrice(Number(v.mrp || 0), variantPromo);

      return {
        ...v,
        imageUrl: variantImage ? variantImage.url : null,
        promoPrice: variantPromoCalculation?.promoPrice || null,
        promoBadge: variantPromoCalculation?.badgeText || null,
        promotion: variantPromoCalculation ? {
          name: variantPromoCalculation.schemeName,
          badgeText: variantPromoCalculation.badgeText,
          discountAmount: variantPromoCalculation.discountAmount,
          promoType: variantPromoCalculation.promoType,
        } : null,
      };
    });

    const effectiveBasePrice = Number(product.mrp || 0) > 0
      ? Number(product.mrp)
      : (mappedVariants.length > 0
          ? Math.min(...mappedVariants.map((v: any) => Number(v.mrp) || 0).filter((val: number) => val > 0))
          : 0);

    const productPromoCalculation = calculatePromoPrice(effectiveBasePrice, productPromo);
    const activeVariantPromo = mappedVariants.find(v => v.promoPrice || v.promoBadge);
    const effectivePromoPrice = productPromoCalculation?.promoPrice || activeVariantPromo?.promoPrice || null;
    const effectivePromoBadge = productPromoCalculation?.badgeText || activeVariantPromo?.promoBadge || null;
    const effectivePromotion = productPromoCalculation ? {
      name: productPromoCalculation.schemeName,
      badgeText: productPromoCalculation.badgeText,
      discountAmount: productPromoCalculation.discountAmount,
      promoType: productPromoCalculation.promoType,
    } : (activeVariantPromo?.promotion || null);

    return {
      ...product,
      promoPrice: effectivePromoPrice,
      promoBadge: effectivePromoBadge,
      promotion: effectivePromotion,
      variants: mappedVariants,
      images,
    };
  },

  /**
   * Retrieve organization public details by slug.
   */
  async getPublicOrganization(slug: string) {
    const [org] = await db
      .select({
        name: organizations.name,
        legalName: organizations.legalName,
        logoUrl: organizations.logoUrl,
        email: organizations.email,
        phone: organizations.phone,
        website: organizations.website,
        addressLine1: organizations.addressLine1,
        addressLine2: organizations.addressLine2,
        city: organizations.city,
        stateName: organizations.stateName,
        pincode: organizations.pincode,
        country: organizations.country,
        settings: organizations.settings,
      })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!org) {
      throw ApiError.notFound('Organization not found');
    }
    return org;
  },

  /**
   * List public categories for an organization slug.
   */
  async listPublicCategories(orgSlug: string) {
    const orgId = await this.getOrgIdBySlug(orgSlug);
    return await db
      .select()
      .from(categories)
      .where(and(eq(categories.orgId, orgId), isNull(categories.deletedAt)))
      .orderBy(categories.sortOrder);
  },

  /**
   * List public brands for an organization slug.
   */
  async listPublicBrands(orgSlug: string) {
    const orgId = await this.getOrgIdBySlug(orgSlug);
    return await db
      .select()
      .from(brands)
      .where(and(eq(brands.orgId, orgId), isNull(brands.deletedAt)))
      .orderBy(brands.name);
  },

  /**
   * List active public promotions (Clearance sale, special offers, flash sales) for an organization.
   */
  async listPublicPromotions(orgSlug: string) {
    const orgId = await this.getOrgIdBySlug(orgSlug);
    const today = new Date().toISOString().split('T')[0];

    const activePromos = await db.query.promotionalSchemes.findMany({
      where: (ps, { and, eq, lte, gte }) => and(
        eq(ps.orgId, orgId),
        eq(ps.isActive, true),
        lte(ps.validFrom, today),
        gte(ps.validTo, today)
      ),
      with: {
        items: {
          with: {
            brand: true,
            product: true,
            variant: true,
            category: true,
          }
        }
      },
      orderBy: (ps, { desc }) => [desc(ps.priority), desc(ps.createdAt)]
    });

    return activePromos;
  },

  /**
   * List all distinct attribute names (keys) used in organization's variants.
   */
  async listAttributes(orgId: string): Promise<string[]> {
    const result = await db
      .select({
        key: sql<string>`jsonb_object_keys(${productVariants.attributes})`
      })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.orgId, orgId),
          isNull(productVariants.deletedAt),
          sql`${productVariants.attributes} IS NOT NULL`
        )
      );

    const uniqueMap = new Map<string, string>();
    result.map(r => r.key).filter(Boolean).forEach(rawKey => {
      const key = rawKey.trim();
      const lower = key.toLowerCase();
      if (!uniqueMap.has(lower)) {
        const formatted = key.replace(/\b\w/g, c => c.toUpperCase());
        uniqueMap.set(lower, formatted);
      }
    });
    return Array.from(uniqueMap.values()).sort();
  },

  /**
   * List all distinct attributes and their available values for public storefront filtering.
   */
  async listPublicAttributes(orgSlug: string, categoryId?: string): Promise<Record<string, string[]>> {
    const orgId = await this.getOrgIdBySlug(orgSlug);

    // Get all attributes objects from variants of active products
    const query = db
      .select({
        attributes: productVariants.attributes
      })
      .from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(productVariants.orgId, orgId),
          isNull(productVariants.deletedAt),
          eq(products.status, 'active'),
          sql`${productVariants.attributes} IS NOT NULL`,
          categoryId ? eq(products.categoryId, categoryId) : undefined
        )
      );

    const result = await query;
    const attributeValues = new Map<string, Set<string>>();

    result.forEach((row) => {
      if (!row.attributes || typeof row.attributes !== 'object') return;
      Object.entries(row.attributes).forEach(([key, val]) => {
        if (val == null || val === '') return;
        const normalizedKey = key.trim().replace(/\b\w/g, c => c.toUpperCase());
        const strVal = String(val).trim();
        if (!attributeValues.has(normalizedKey)) {
          attributeValues.set(normalizedKey, new Set());
        }
        attributeValues.get(normalizedKey)!.add(strVal);
      });
    });

    const response: Record<string, string[]> = {};
    for (const [key, set] of attributeValues.entries()) {
      response[key] = Array.from(set).sort();
    }
    return response;
  },

  /**
   * Retrieve variant price history logs.
   */
  async getVariantPriceHistory(orgId: string, variantId: string) {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.orgId, orgId), eq(productVariants.id, variantId), isNull(productVariants.deletedAt)))
      .limit(1);

    if (!variant) {
      throw ApiError.notFound('Variant not found');
    }

    return await db
      .select({
        id: productVariantPriceHistory.id,
        
        
        
        mrp: productVariantPriceHistory.mrp,
        createdAt: productVariantPriceHistory.createdAt,
        createdBy: productVariantPriceHistory.createdBy,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }
      })
      .from(productVariantPriceHistory)
      .leftJoin(users, eq(productVariantPriceHistory.createdBy, users.id))
      .where(eq(productVariantPriceHistory.variantId, variantId))
      .orderBy(desc(productVariantPriceHistory.createdAt));
  },

  /**
   * Retrieve base product price history logs (for non-variant products).
   */
  async getProductPriceHistory(orgId: string, productId: string) {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.orgId, orgId), eq(products.id, productId), isNull(products.deletedAt)))
      .limit(1);

    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    return await db
      .select({
        id: productVariantPriceHistory.id,
        
        
        
        mrp: productVariantPriceHistory.mrp,
        createdAt: productVariantPriceHistory.createdAt,
        createdBy: productVariantPriceHistory.createdBy,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        }
      })
      .from(productVariantPriceHistory)
      .leftJoin(users, eq(productVariantPriceHistory.createdBy, users.id))
      .where(and(
        eq(productVariantPriceHistory.productId, productId),
        isNull(productVariantPriceHistory.variantId)
      ))
      .orderBy(desc(productVariantPriceHistory.createdAt));
  },



  /**
   * Retrieves product analytics (sales/purchase history & insights).
   */
  async getProductAnalytics(orgId: string, productId: string, variantId?: string) {
    const [product] = await db.select().from(products).where(and(eq(products.orgId, orgId), eq(products.id, productId)));
    if (!product) throw ApiError.notFound('Product not found');

    // Fetch product variants to map variant names
    const variantsList = await db.select().from(productVariants).where(and(eq(productVariants.orgId, orgId), eq(productVariants.productId, productId)));

    // Fetch product images
    const imagesList = await db.select().from(productImages).where(and(eq(productImages.orgId, orgId), eq(productImages.productId, productId))).orderBy(asc(productImages.sortOrder));
    const primaryImage = imagesList.find(img => img.isPrimary) || imagesList[0] || null;
    let imageUrl = null;
    
    if (primaryImage) {
      imageUrl = primaryImage.thumbnailUrl ? getS3PublicUrl(primaryImage.thumbnailUrl) : getS3PublicUrl(primaryImage.url);
    }

    // Fetch history from invoices
    const conditions = [
      eq(invoices.orgId, orgId), 
      eq(invoiceLineItems.productId, productId),
      inArray(invoices.documentType, ['sales_invoice', 'purchase_invoice']),
      inArray(invoices.status, ['draft', 'approved', 'sent', 'paid', 'partially_paid'])
    ];
    if (variantId) {
      conditions.push(eq(invoiceLineItems.variantId, variantId));
    }

    const historyData = await db.select({
      id: invoiceLineItems.id,
      invoiceId: invoices.id,
      documentType: invoices.documentType,
      invoiceNumber: invoices.invoiceNumber,
      invoiceDate: invoices.invoiceDate,
      contactId: invoices.contactId,
      contactName: contacts.displayName,
      contactCompany: contacts.companyName,
      variantId: invoiceLineItems.variantId,
      quantity: invoiceLineItems.quantity,
      unitPrice: invoiceLineItems.unitPrice,
      totalAmount: invoiceLineItems.totalAmount,
    })
    .from(invoiceLineItems)
    .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
    .innerJoin(contacts, eq(invoices.contactId, contacts.id))
    .where(and(...conditions))
    .orderBy(desc(invoices.invoiceDate));

    // Fetch orders related to product
    // Note: We might want to fetch order line items later if needed, but for now we just summarize from invoices

    let totalQuantitySold = 0;
    let totalAmountSold = 0;
    let totalQuantityBought = 0;
    let totalAmountBought = 0;

    const salesHistory: any[] = [];
    const purchaseHistory: any[] = [];

    historyData.forEach(item => {
      const variant = variantsList.find(v => v.id === item.variantId);
      const mappedItem = {
        ...item,
        variantName: variant ? variant.name : null,
      };

      if (item.documentType === 'sales_invoice') {
        salesHistory.push(mappedItem);
        totalQuantitySold += Number(item.quantity);
        totalAmountSold += Number(item.totalAmount);
      } else if (item.documentType === 'purchase_invoice') {
        purchaseHistory.push(mappedItem);
        totalQuantityBought += Number(item.quantity);
        totalAmountBought += Number(item.totalAmount);
      }
    });

    // Current stock from inventory
    const invConditions: any[] = [eq(inventory.orgId, orgId), eq(inventory.productId, productId)];
    if (variantId) invConditions.push(eq(inventory.variantId, variantId));
    const inventoryData = await db.select().from(inventory).where(and(...invConditions));
    const currentStock = inventoryData.reduce((acc, curr) => acc + Number(curr.quantityOnHand || 0), 0);

    // Determine pricing to show
    let pricing: { mrp: string; valuationCost?: string } = {
      mrp: product.mrp,
      valuationCost: product.valuationCost,
    };
    if (variantId) {
      const selectedVariant = variantsList.find(v => v.id === variantId);
      if (selectedVariant) {
        pricing = {
          mrp: selectedVariant.mrp,
          valuationCost: selectedVariant.valuationCost,
        };
      }
    }

    return {
      product: {
        ...product,
        imageUrl,
      },
      pricing,
      insights: {
        totalQuantitySold,
        totalAmountSold,
        totalQuantityBought,
        totalAmountBought,
        currentStock,
        currentStockValue: currentStock * Number(pricing.valuationCost || 0),
      },
      salesHistory,
      purchaseHistory,
    };
  },

  /**
   * Retrieves global product analytics for the dashboard when no product is selected.
   * Returns top sold items and top unsold items.
   */
  async getGlobalAnalytics(orgId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const salesData = await db.select({
      productId: invoiceLineItems.productId,
      variantId: invoiceLineItems.variantId,
      productName: products.name,
      variantName: productVariants.name,
      totalQuantitySold: sql<number>`SUM(${invoiceLineItems.quantity})`.mapWith(Number),
    })
    .from(invoiceLineItems)
    .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
    .innerJoin(products, eq(invoiceLineItems.productId, products.id))
    .leftJoin(productVariants, eq(invoiceLineItems.variantId, productVariants.id))
    .where(and(
      eq(invoices.orgId, orgId),
      eq(invoices.documentType, 'sales_invoice'),
      inArray(invoices.status, ['approved', 'sent', 'paid', 'partially_paid'])
    ))
    .groupBy(invoiceLineItems.productId, products.name, invoiceLineItems.variantId, productVariants.name)
    .orderBy(desc(sql`SUM(${invoiceLineItems.quantity})`))
    .limit(limit)
    .offset(offset);

    const inventoryData = await db.select({
      productId: inventory.productId,
      variantId: inventory.variantId,
      productName: products.name,
      variantName: productVariants.name,
      totalAvailableQty: sql<number>`SUM(${inventory.quantityOnHand})`.mapWith(Number),
      totalStockValue: sql<number>`SUM(${inventory.quantityOnHand} * COALESCE(${productVariants.valuationCost}, ${products.valuationCost}))`.mapWith(Number),
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .leftJoin(productVariants, eq(inventory.variantId, productVariants.id))
    .where(eq(inventory.orgId, orgId))
    .groupBy(inventory.productId, products.name, inventory.variantId, productVariants.name)
    .orderBy(desc(sql`SUM(${inventory.quantityOnHand})`))
    .limit(limit)
    .offset(offset);

    return {
      topSold: salesData,
      topUnsold: inventoryData,
      nextPage: salesData.length === limit || inventoryData.length === limit ? page + 1 : null
    };
  },

  /**
   * Retrieves all products and variants formatted for bulk price editing.
   */
  async listProductsForBulkPricing(orgId: string, filters: { search?: string; categoryId?: string; brandId?: string }) {
    const conditions: any[] = [
      eq(products.orgId, orgId),
      isNull(products.deletedAt),
    ];

    if (filters.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }
    if (filters.brandId) {
      conditions.push(eq(products.brandId, filters.brandId));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.sku, `%${filters.search}%`)
        )
      );
    }

    const prods = await db.query.products.findMany({
      where: and(...conditions),
      with: {
        category: true,
        brand: true,
        variants: {
          where: isNull(productVariants.deletedAt),
        },
      },
      orderBy: (p, { asc }) => [asc(p.name)],
    });

    // Flatten into unified editable item list
    const items: any[] = [];
    prods.forEach(p => {
      if (p.hasVariants && p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          items.push({
            id: `variant_${v.id}`,
            productId: p.id,
            variantId: v.id,
            isVariant: true,
            name: `${p.name} - ${v.name}`,
            sku: v.sku,
            barcode: v.barcode,
            categoryName: p.category?.name || '—',
            brandName: p.brand?.name || '—',
            categoryId: p.categoryId,
            brandId: p.brandId,
            valuationCost: Number(v.valuationCost || 0),
            sellingPrice: Number(v.sellingPrice || v.mrp || 0),
            mrp: Number(v.mrp || 0),
            boxQuantity: Number(v.boxQuantity || p.boxQuantity || 1),
          });
        });
      } else {
        items.push({
          id: `product_${p.id}`,
          productId: p.id,
          variantId: null,
          isVariant: false,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          categoryName: p.category?.name || '—',
          brandName: p.brand?.name || '—',
          categoryId: p.categoryId,
          brandId: p.brandId,
          valuationCost: Number(p.valuationCost || 0),
          sellingPrice: Number(p.sellingPrice || p.mrp || 0),
          mrp: Number(p.mrp || 0),
          boxQuantity: Number(p.boxQuantity || 1),
        });
      }
    });

    return items;
  },

  /**
   * Bulk updates valuationCost (purchase price), sellingPrice, and mrp across products/variants in a single transaction.
   */
  async bulkUpdatePricing(
    orgId: string,
    userId: string,
    payload: {
      productUpdates?: Array<{ id: string; valuationCost?: number; sellingPrice?: number; mrp?: number }>;
      variantUpdates?: Array<{ id: string; productId: string; valuationCost?: number; sellingPrice?: number; mrp?: number }>;
    }
  ) {
    let updatedCount = 0;

    await db.transaction(async (tx) => {
      // 1. Process Product updates
      if (payload.productUpdates && payload.productUpdates.length > 0) {
        for (const item of payload.productUpdates) {
          const updateData: any = { updatedAt: new Date() };
          if (item.valuationCost !== undefined) updateData.valuationCost = String(item.valuationCost);
          if (item.sellingPrice !== undefined) updateData.sellingPrice = String(item.sellingPrice);
          if (item.mrp !== undefined) updateData.mrp = String(item.mrp);

          await tx
            .update(products)
            .set(updateData)
            .where(and(eq(products.id, item.id), eq(products.orgId, orgId)));

          // Record in price history if cost changed
          if (item.valuationCost !== undefined) {
            await tx.insert(productVariantPriceHistory).values({
              orgId,
              productId: item.id,
              variantId: null,
              valuationCost: String(item.valuationCost),
              mrp: item.mrp !== undefined ? String(item.mrp) : '0',
              createdBy: userId,
            });
          }
          updatedCount++;
        }
      }

      // 2. Process Variant updates
      if (payload.variantUpdates && payload.variantUpdates.length > 0) {
        for (const item of payload.variantUpdates) {
          const updateData: any = { updatedAt: new Date() };
          if (item.valuationCost !== undefined) updateData.valuationCost = String(item.valuationCost);
          if (item.sellingPrice !== undefined) updateData.sellingPrice = String(item.sellingPrice);
          if (item.mrp !== undefined) updateData.mrp = String(item.mrp);

          await tx
            .update(productVariants)
            .set(updateData)
            .where(and(eq(productVariants.id, item.id), eq(productVariants.orgId, orgId)));

          // Record in price history if cost changed
          if (item.valuationCost !== undefined) {
            await tx.insert(productVariantPriceHistory).values({
              orgId,
              productId: item.productId,
              variantId: item.id,
              valuationCost: String(item.valuationCost),
              mrp: item.mrp !== undefined ? String(item.mrp) : '0',
              createdBy: userId,
            });
          }
          updatedCount++;
        }
      }
    });

    return { updated: updatedCount };
  },
};

