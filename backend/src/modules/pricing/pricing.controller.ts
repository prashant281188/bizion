import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/api-response.js';
import { db } from '../../db/index.js';
import { priceLists } from '../../db/schema/price-lists.js';
import { promotionalSchemes, promotionalSchemeItems } from '../../db/schema/promotions.js';
import { eq } from 'drizzle-orm';
import { PricingService } from './pricing.service.js';

export const getPriceLists = async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const lists = await db.query.priceLists.findMany({ where: eq(priceLists.orgId, orgId) });
    sendSuccess(res, lists);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
};

export const createPriceList = async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const [list] = await db.insert(priceLists).values({ orgId, createdBy: req.user!.userId, ...req.body }).returning();
    sendSuccess(res, list, 'Created', 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
};

export const getPriceList = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const list = await db.query.priceLists.findFirst({ where: eq(priceLists.id, id) });
    sendSuccess(res, list);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
};

export const updatePriceList = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const [list] = await db.update(priceLists).set(req.body).where(eq(priceLists.id, id)).returning();
    sendSuccess(res, list);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
};

export const deletePriceList = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await db.delete(priceLists).where(eq(priceLists.id, id));
    sendSuccess(res, null, 'Deleted');
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
};

export const getPriceListItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId;
    const priceListId = req.params.id as string;
    const search = req.query.q as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const brandId = req.query.brandId as string | undefined;

    const page = req.query.page as string | undefined;
    const limit = req.query.limit as string | undefined;

    const data = await PricingService.getPriceListItems(orgId, priceListId, { search, categoryId, brandId, page, limit });
    sendSuccess(res, data, 'Price list items retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const updatePriceListItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId;
    const priceListId = req.params.id as string;
    
    await PricingService.updatePriceListItems(orgId, priceListId, req.body.items);
    sendSuccess(res, null, 'Price list items updated successfully');
  } catch (error) {
    next(error);
  }
};

export const getSchemes = async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const schemes = await db.query.promotionalSchemes.findMany({
      where: eq(promotionalSchemes.orgId, orgId),
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
      orderBy: (schemes, { desc }) => [desc(schemes.createdAt)]
    });
    sendSuccess(res, schemes);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
};

export const createScheme = async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.orgId;
    const { items, ...schemeData } = req.body;

    const [scheme] = await db.insert(promotionalSchemes).values({
      orgId,
      createdBy: req.user!.userId,
      ...schemeData
    }).returning();

    if (items && Array.isArray(items) && items.length > 0) {
      await db.insert(promotionalSchemeItems).values(
        items.map((item: any) => ({
          schemeId: scheme.id,
          brandId: item.brandId || null,
          productId: item.productId || null,
          variantId: item.variantId || null,
          categoryId: item.categoryId || null,
        }))
      );
    }

    const fullScheme = await db.query.promotionalSchemes.findFirst({
      where: eq(promotionalSchemes.id, scheme.id),
      with: {
        items: {
          with: {
            brand: true,
            product: true,
            variant: true,
            category: true,
          }
        }
      }
    });

    sendSuccess(res, fullScheme, 'Promotion created successfully', 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
};

export const getScheme = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const scheme = await db.query.promotionalSchemes.findFirst({
      where: eq(promotionalSchemes.id, id),
      with: {
        items: {
          with: {
            brand: true,
            product: true,
            variant: true,
            category: true,
          }
        }
      }
    });
    if (!scheme) {
      return sendError(res, 'Promotion not found', 404);
    }
    sendSuccess(res, scheme);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
};

export const updateScheme = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { items, ...schemeData } = req.body;

    const [scheme] = await db.update(promotionalSchemes)
      .set({ ...schemeData, updatedAt: new Date() })
      .where(eq(promotionalSchemes.id, id))
      .returning();

    if (items !== undefined && Array.isArray(items)) {
      // Replace existing items
      await db.delete(promotionalSchemeItems).where(eq(promotionalSchemeItems.schemeId, id));
      if (items.length > 0) {
        await db.insert(promotionalSchemeItems).values(
          items.map((item: any) => ({
            schemeId: id,
            brandId: item.brandId || null,
            productId: item.productId || null,
            variantId: item.variantId || null,
            categoryId: item.categoryId || null,
          }))
        );
      }
    }

    const fullScheme = await db.query.promotionalSchemes.findFirst({
      where: eq(promotionalSchemes.id, id),
      with: {
        items: {
          with: {
            brand: true,
            product: true,
            variant: true,
            category: true,
          }
        }
      }
    });

    sendSuccess(res, fullScheme, 'Promotion updated successfully');
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
};

export const deleteScheme = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await db.delete(promotionalSchemes).where(eq(promotionalSchemes.id, id));
    sendSuccess(res, null, 'Promotion deleted successfully');
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
};

export const resolvePrice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId;
    const { contactId, productId, variantId, quantity, type } = req.body;

    const result = await PricingService.resolvePrice({
      orgId,
      contactId,
      productId,
      variantId,
      quantity: Number(quantity) || 1,
      type: type || 'sales',
    });

    sendSuccess(res, result, 'Price resolved successfully');
  } catch (error) {
    next(error);
  }
};


