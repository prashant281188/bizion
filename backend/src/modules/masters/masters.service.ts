import { db } from '../../db/index.js';
import { categories, brands, unitsOfMeasurement, taxRates, paymentTerms, hsnCodes, contactGroups, hsnRateHistory } from '../../db/schema/masters.js';
import { products } from '../../db/schema/products.js';
import { ApiError } from '../../utils/api-error.js';
import { eq, and, isNull, like, or, sql, desc, asc, ilike } from 'drizzle-orm';
import { slugify } from '../../utils/slugify.js';

export const mastersService = {
  // ─── Bootstrap ─────────────────────────────────────────────────────────────
  async bootstrap(orgId: string) {
    const [categories, brands, units, taxRates, hsnCodes] = await Promise.all([
      this.listCategories(orgId, { limit: 500 }),
      this.listBrands(orgId, { limit: 500 }),
      this.listUnits(orgId, { limit: 500 }),
      this.listTaxRates(orgId, { limit: 500 }),
      this.listHsnCodes(orgId, { limit: 500 }),
    ]);

    return { categories, brands, units, taxRates, hsnCodes };
  },

  // ─── Categories ────────────────────────────────────────────────────────────
    async listCategories(
    orgId: string,
    options: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(categories.orgId, orgId), isNull(categories.deletedAt)];

    if (options.search) {
      conditions.push(ilike(categories.name, `%${options.search}%`));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const data = await db
      .select()
      .from(categories)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        (() => {
          if (options.sortBy && options.sortOrder) {
            const orderFn = options.sortOrder === 'desc' ? desc : asc;
            switch (options.sortBy) {
              case 'name': return orderFn(categories.name);
              case 'sortOrder': return orderFn(categories.sortOrder);
              
              
              
              case 'createdAt': return orderFn(categories.createdAt);
            }
          }
          return asc(categories.sortOrder);
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

  async getCategoryById(orgId: string, id: string) {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.orgId, orgId), eq(categories.id, id), isNull(categories.deletedAt)))
      .limit(1);

    if (!category) {
      throw ApiError.notFound('Category not found');
    }
    return category;
  },

  async createCategory(orgId: string, input: any) {
    // Ensure name uniqueness within org
    const [nameExists] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.orgId, orgId), eq(categories.name, input.name), isNull(categories.deletedAt)))
      .limit(1);

    if (nameExists) {
      throw ApiError.badRequest('A category with this name already exists');
    }

    let slug = slugify(input.name);
    // Ensure slug uniqueness within org
    const [existing] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.orgId, orgId), eq(categories.slug, slug), isNull(categories.deletedAt)))
      .limit(1);

    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const [category] = await db
      .insert(categories)
      .values({
        orgId,
        parentId: input.parentId || null,
        name: input.name,
        slug,
        description: input.description || null,
        imageUrl: input.imageUrl || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
      })
      .returning();

    return category;
  },

  async updateCategory(orgId: string, id: string, input: any) {
    await this.getCategoryById(orgId, id);

    let updateData = { ...input, updatedAt: new Date() };
    if (input.name) {
      // Ensure name uniqueness within org
      const [nameExists] = await db
        .select()
        .from(categories)
        .where(and(eq(categories.orgId, orgId), eq(categories.name, input.name), isNull(categories.deletedAt)))
        .limit(1);

      if (nameExists && nameExists.id !== id) {
        throw ApiError.badRequest('A category with this name already exists');
      }

      let slug = slugify(input.name);
      // Ensure slug uniqueness within org
      const [existing] = await db
        .select()
        .from(categories)
        .where(and(eq(categories.orgId, orgId), eq(categories.slug, slug), isNull(categories.deletedAt)))
        .limit(1);

      if (existing && existing.id !== id) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
      updateData.slug = slug;
    }

    const [category] = await db
      .update(categories)
      .set(updateData)
      .where(and(eq(categories.orgId, orgId), eq(categories.id, id)))
      .returning();

    return category;
  },

  async deleteCategory(orgId: string, id: string) {
    await this.getCategoryById(orgId, id);

    // Check if any product is using this category
    const [linkedProduct] = await db
      .select()
      .from(products)
      .where(and(eq(products.orgId, orgId), eq(products.categoryId, id), isNull(products.deletedAt)))
      .limit(1);

    if (linkedProduct) {
      throw ApiError.badRequest('Cannot delete category because it is currently linked to one or more products');
    }

    // Set parentId to null for sub-categories
    await db
      .update(categories)
      .set({ parentId: null, updatedAt: new Date() })
      .where(and(eq(categories.orgId, orgId), eq(categories.parentId, id)));

    await db
      .update(categories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(categories.orgId, orgId), eq(categories.id, id)));
  },

  // ─── Brands ────────────────────────────────────────────────────────────────
    async listBrands(
    orgId: string,
    options: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(brands.orgId, orgId), isNull(brands.deletedAt)];

    if (options.search) {
      conditions.push(ilike(brands.name, `%${options.search}%`));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(brands)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const data = await db
      .select()
      .from(brands)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        (() => {
          if (options.sortBy && options.sortOrder) {
            const orderFn = options.sortOrder === 'desc' ? desc : asc;
            switch (options.sortBy) {
              case 'name': return orderFn(brands.name);
              
              
              
              
              case 'createdAt': return orderFn(brands.createdAt);
            }
          }
          return asc(brands.name);
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

  async getBrandById(orgId: string, id: string) {
    const [brand] = await db
      .select()
      .from(brands)
      .where(and(eq(brands.orgId, orgId), eq(brands.id, id), isNull(brands.deletedAt)))
      .limit(1);

    if (!brand) {
      throw ApiError.notFound('Brand not found');
    }
    return brand;
  },

  async createBrand(orgId: string, input: any) {
    // Ensure name uniqueness within org
    const [nameExists] = await db
      .select()
      .from(brands)
      .where(and(eq(brands.orgId, orgId), eq(brands.name, input.name), isNull(brands.deletedAt)))
      .limit(1);

    if (nameExists) {
      throw ApiError.badRequest('A brand with this name already exists');
    }

    let slug = slugify(input.name);
    // Ensure slug uniqueness within org
    const [existing] = await db
      .select()
      .from(brands)
      .where(and(eq(brands.orgId, orgId), eq(brands.slug, slug), isNull(brands.deletedAt)))
      .limit(1);

    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const [brand] = await db
      .insert(brands)
      .values({
        orgId,
        name: input.name,
        slug,
        logoUrl: input.logoUrl || null,
        description: input.description || null,
        isActive: input.isActive ?? true,
      })
      .returning();

    return brand;
  },

  async updateBrand(orgId: string, id: string, input: any) {
    await this.getBrandById(orgId, id);

    let updateData = { ...input, updatedAt: new Date() };
    if (input.name) {
      // Ensure name uniqueness within org
      const [nameExists] = await db
        .select()
        .from(brands)
        .where(and(eq(brands.orgId, orgId), eq(brands.name, input.name), isNull(brands.deletedAt)))
        .limit(1);

      if (nameExists && nameExists.id !== id) {
        throw ApiError.badRequest('A brand with this name already exists');
      }

      let slug = slugify(input.name);
      const [existing] = await db
        .select()
        .from(brands)
        .where(and(eq(brands.orgId, orgId), eq(brands.slug, slug), isNull(brands.deletedAt)))
        .limit(1);

      if (existing && existing.id !== id) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
      updateData.slug = slug;
    }

    const [brand] = await db
      .update(brands)
      .set(updateData)
      .where(and(eq(brands.orgId, orgId), eq(brands.id, id)))
      .returning();

    return brand;
  },

  async deleteBrand(orgId: string, id: string) {
    await this.getBrandById(orgId, id);

    // Check if any product is using this brand
    const [linkedProduct] = await db
      .select()
      .from(products)
      .where(and(eq(products.orgId, orgId), eq(products.brandId, id), isNull(products.deletedAt)))
      .limit(1);

    if (linkedProduct) {
      throw ApiError.badRequest('Cannot delete brand because it is currently linked to one or more products');
    }

    await db
      .update(brands)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(brands.orgId, orgId), eq(brands.id, id)));
  },

  // ─── Units of Measurement ──────────────────────────────────────────────────
    async listUnits(
    orgId: string,
    options: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(unitsOfMeasurement.orgId, orgId), isNull(unitsOfMeasurement.deletedAt)];

    if (options.search) {
      conditions.push(ilike(unitsOfMeasurement.name, `%${options.search}%`));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(unitsOfMeasurement)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const data = await db
      .select()
      .from(unitsOfMeasurement)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        (() => {
          if (options.sortBy && options.sortOrder) {
            const orderFn = options.sortOrder === 'desc' ? desc : asc;
            switch (options.sortBy) {
              case 'name': return orderFn(unitsOfMeasurement.name);
              
              case 'code': return orderFn(unitsOfMeasurement.code);
              
              
              case 'createdAt': return orderFn(unitsOfMeasurement.createdAt);
            }
          }
          return asc(unitsOfMeasurement.code);
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

  async getUnitById(orgId: string, id: string) {
    const [unit] = await db
      .select()
      .from(unitsOfMeasurement)
      .where(and(eq(unitsOfMeasurement.orgId, orgId), eq(unitsOfMeasurement.id, id), isNull(unitsOfMeasurement.deletedAt)))
      .limit(1);

    if (!unit) {
      throw ApiError.notFound('Unit of measurement not found');
    }
    return unit;
  },

  async createUnit(orgId: string, input: any) {
    // Ensure code and name uniqueness within org
    const [existing] = await db
      .select()
      .from(unitsOfMeasurement)
      .where(
        and(
          eq(unitsOfMeasurement.orgId, orgId),
          isNull(unitsOfMeasurement.deletedAt),
          or(
            eq(unitsOfMeasurement.code, input.code.toUpperCase()),
            eq(unitsOfMeasurement.name, input.name)
          )
        )
      )
      .limit(1);

    if (existing) {
      if (existing.code === input.code.toUpperCase()) {
        throw ApiError.badRequest('A unit of measurement with this code already exists');
      }
      throw ApiError.badRequest('A unit of measurement with this name already exists');
    }

    if (input.isDefault) {
      // Clear other defaults
      await db
        .update(unitsOfMeasurement)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(unitsOfMeasurement.orgId, orgId), eq(unitsOfMeasurement.isDefault, true)));
    }

    const [unit] = await db
      .insert(unitsOfMeasurement)
      .values({
        orgId,
        code: input.code.toUpperCase(),
        name: input.name,
        uqcCode: input.uqcCode ? input.uqcCode.toUpperCase() : null,
        isDefault: input.isDefault ?? false,
      })
      .returning();

    return unit;
  },

  async updateUnit(orgId: string, id: string, input: any) {
    await this.getUnitById(orgId, id);

    if (input.code || input.name) {
      const checkCode = input.code ? input.code.toUpperCase() : undefined;
      const conditions = [];
      if (checkCode) conditions.push(eq(unitsOfMeasurement.code, checkCode));
      if (input.name) conditions.push(eq(unitsOfMeasurement.name, input.name));

      const [existing] = await db
        .select()
        .from(unitsOfMeasurement)
        .where(
          and(
            eq(unitsOfMeasurement.orgId, orgId),
            isNull(unitsOfMeasurement.deletedAt),
            or(...conditions)
          )
        )
        .limit(1);

      if (existing && existing.id !== id) {
        if (checkCode && existing.code === checkCode) {
          throw ApiError.badRequest('A unit of measurement with this code already exists');
        }
        throw ApiError.badRequest('A unit of measurement with this name already exists');
      }
    }

    if (input.isDefault) {
      await db
        .update(unitsOfMeasurement)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(unitsOfMeasurement.orgId, orgId), eq(unitsOfMeasurement.isDefault, true)));
    }

    const [unit] = await db
      .update(unitsOfMeasurement)
      .set({
        ...input,
        code: input.code ? input.code.toUpperCase() : undefined,
        uqcCode: input.uqcCode ? input.uqcCode.toUpperCase() : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(unitsOfMeasurement.orgId, orgId), eq(unitsOfMeasurement.id, id)))
      .returning();

    return unit;
  },

  async deleteUnit(orgId: string, id: string) {
    const unit = await this.getUnitById(orgId, id);
    if (unit.isDefault) {
      throw ApiError.badRequest('Cannot delete the default unit of measurement');
    }

    // Check if any product is using this unit
    const [linkedProduct] = await db
      .select()
      .from(products)
      .where(and(eq(products.orgId, orgId), eq(products.uomId, id), isNull(products.deletedAt)))
      .limit(1);

    if (linkedProduct) {
      throw ApiError.badRequest('Cannot delete unit of measurement because it is currently linked to one or more products');
    }

    await db
      .update(unitsOfMeasurement)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(unitsOfMeasurement.orgId, orgId), eq(unitsOfMeasurement.id, id)));
  },

  // ─── Tax Rates ─────────────────────────────────────────────────────────────
    async listTaxRates(
    orgId: string,
    options: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(taxRates.orgId, orgId), isNull(taxRates.deletedAt)];

    if (options.search) {
      conditions.push(ilike(taxRates.name, `%${options.search}%`));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(taxRates)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const data = await db
      .select()
      .from(taxRates)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        (() => {
          if (options.sortBy && options.sortOrder) {
            const orderFn = options.sortOrder === 'desc' ? desc : asc;
            switch (options.sortBy) {
              case 'name': return orderFn(taxRates.name);
              
              
              case 'ratePercentage': return orderFn(taxRates.ratePercentage);
              
              case 'createdAt': return orderFn(taxRates.createdAt);
            }
          }
          return asc(taxRates.ratePercentage);
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

  async getTaxRateById(orgId: string, id: string) {
    const [rate] = await db
      .select()
      .from(taxRates)
      .where(and(eq(taxRates.orgId, orgId), eq(taxRates.id, id), isNull(taxRates.deletedAt)))
      .limit(1);

    if (!rate) {
      throw ApiError.notFound('Tax rate not found');
    }
    return rate;
  },

  async createTaxRate(orgId: string, input: any) {
    // Ensure name uniqueness within org
    const [nameExists] = await db
      .select()
      .from(taxRates)
      .where(and(eq(taxRates.orgId, orgId), eq(taxRates.name, input.name), isNull(taxRates.deletedAt)))
      .limit(1);

    if (nameExists) {
      throw ApiError.badRequest('A tax rate with this name already exists');
    }

    const totalRate = Number(input.ratePercentage);
    const cgst = (totalRate / 2).toFixed(2);
    const sgst = (totalRate / 2).toFixed(2);
    const igst = totalRate.toFixed(2);
    const cess = Number(input.cessRate || 0).toFixed(2);

    if (input.isDefault) {
      await db
        .update(taxRates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(taxRates.orgId, orgId), eq(taxRates.isDefault, true)));
    }

    const [rate] = await db
      .insert(taxRates)
      .values({
        orgId,
        name: input.name,
        ratePercentage: totalRate.toFixed(2),
        cgstRate: cgst,
        sgstRate: sgst,
        igstRate: igst,
        cessRate: cess,
        isDefault: input.isDefault ?? false,
        isActive: input.isActive ?? true,
      })
      .returning();

    return rate;
  },

  async updateTaxRate(orgId: string, id: string, input: any) {
    await this.getTaxRateById(orgId, id);

    if (input.name) {
      // Ensure name uniqueness within org
      const [nameExists] = await db
        .select()
        .from(taxRates)
        .where(and(eq(taxRates.orgId, orgId), eq(taxRates.name, input.name), isNull(taxRates.deletedAt)))
        .limit(1);

      if (nameExists && nameExists.id !== id) {
        throw ApiError.badRequest('A tax rate with this name already exists');
      }
    }

    let ratesUpdate: any = {};
    if (input.ratePercentage !== undefined) {
      const totalRate = Number(input.ratePercentage);
      ratesUpdate.ratePercentage = totalRate.toFixed(2);
      ratesUpdate.cgstRate = (totalRate / 2).toFixed(2);
      ratesUpdate.sgstRate = (totalRate / 2).toFixed(2);
      ratesUpdate.igstRate = totalRate.toFixed(2);
    }
    if (input.cessRate !== undefined) {
      ratesUpdate.cessRate = Number(input.cessRate).toFixed(2);
    }

    if (input.isDefault) {
      await db
        .update(taxRates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(taxRates.orgId, orgId), eq(taxRates.isDefault, true)));
    }

    const [rate] = await db
      .update(taxRates)
      .set({
        ...input,
        ...ratesUpdate,
        updatedAt: new Date(),
      })
      .where(and(eq(taxRates.orgId, orgId), eq(taxRates.id, id)))
      .returning();

    return rate;
  },

  async deleteTaxRate(orgId: string, id: string) {
    const rate = await this.getTaxRateById(orgId, id);
    if (rate.isDefault) {
      throw ApiError.badRequest('Cannot delete the default tax rate');
    }

    // Check if any product is using this tax rate
    const [linkedProduct] = await db
      .select()
      .from(products)
      .where(and(eq(products.orgId, orgId), eq(products.taxRateId, id), isNull(products.deletedAt)))
      .limit(1);

    if (linkedProduct) {
      throw ApiError.badRequest('Cannot delete tax rate because it is currently linked to one or more products');
    }

    // Check if any HSN code is using this tax rate
    const [linkedHsn] = await db
      .select()
      .from(hsnCodes)
      .where(and(eq(hsnCodes.orgId, orgId), eq(hsnCodes.taxRateId, id), isNull(hsnCodes.deletedAt)))
      .limit(1);

    if (linkedHsn) {
      throw ApiError.badRequest('Cannot delete tax rate because it is currently linked to one or more HSN/SAC codes');
    }

    await db
      .update(taxRates)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(taxRates.orgId, orgId), eq(taxRates.id, id)));
  },

  // ─── Payment Terms ──────────────────────────────────────────────────────────
    async listPaymentTerms(
    orgId: string,
    options: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(paymentTerms.orgId, orgId), isNull(paymentTerms.deletedAt)];

    if (options.search) {
      conditions.push(ilike(paymentTerms.name, `%${options.search}%`));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentTerms)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const data = await db
      .select()
      .from(paymentTerms)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        (() => {
          if (options.sortBy && options.sortOrder) {
            const orderFn = options.sortOrder === 'desc' ? desc : asc;
            switch (options.sortBy) {
              case 'name': return orderFn(paymentTerms.name);
              
              
              
              case 'dueDays': return orderFn(paymentTerms.dueDays);
              case 'createdAt': return orderFn(paymentTerms.createdAt);
            }
          }
          return asc(paymentTerms.dueDays);
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

  async getPaymentTermById(orgId: string, id: string) {
    const [term] = await db
      .select()
      .from(paymentTerms)
      .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.id, id), isNull(paymentTerms.deletedAt)))
      .limit(1);

    if (!term) {
      throw ApiError.notFound('Payment term not found');
    }
    return term;
  },

  async createPaymentTerm(orgId: string, input: any) {
    // Ensure name uniqueness within org
    const [nameExists] = await db
      .select()
      .from(paymentTerms)
      .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.name, input.name), isNull(paymentTerms.deletedAt)))
      .limit(1);

    if (nameExists) {
      throw ApiError.badRequest('A payment term with this name already exists');
    }

    if (input.isDefault) {
      await db
        .update(paymentTerms)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.isDefault, true)));
    }

    const [term] = await db
      .insert(paymentTerms)
      .values({
        orgId,
        name: input.name,
        dueDays: input.dueDays,
        isDefault: input.isDefault ?? false,
      })
      .returning();

    return term;
  },

  async updatePaymentTerm(orgId: string, id: string, input: any) {
    await this.getPaymentTermById(orgId, id);

    if (input.name) {
      // Ensure name uniqueness within org
      const [nameExists] = await db
        .select()
        .from(paymentTerms)
        .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.name, input.name), isNull(paymentTerms.deletedAt)))
        .limit(1);

      if (nameExists && nameExists.id !== id) {
        throw ApiError.badRequest('A payment term with this name already exists');
      }
    }

    if (input.isDefault) {
      await db
        .update(paymentTerms)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.isDefault, true)));
    }

    const [term] = await db
      .update(paymentTerms)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.id, id)))
      .returning();

    return term;
  },

  async deletePaymentTerm(orgId: string, id: string) {
    const term = await this.getPaymentTermById(orgId, id);
    if (term.isDefault) {
      throw ApiError.badRequest('Cannot delete default payment term');
    }

    await db
      .update(paymentTerms)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(paymentTerms.orgId, orgId), eq(paymentTerms.id, id)));
  },

  // ─── Contact Groups ──────────────────────────────────────────────────────────
    async listContactGroups(
    orgId: string,
    options: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      withBalances?: boolean;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(contactGroups.orgId, orgId), isNull(contactGroups.deletedAt)];

    if (options.search) {
      conditions.push(ilike(contactGroups.name, `%${options.search}%`));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactGroups)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    if (options.withBalances) {
      const balanceQuery = sql`
        (SELECT COALESCE(SUM(c.opening_balance), 0) FROM contacts c WHERE c.contact_group_id = contact_groups.id AND c.deleted_at IS NULL) +
        (SELECT COALESCE(SUM(CASE WHEN inv.document_type IN ('sales_invoice', 'debit_note') THEN inv.balance_due WHEN inv.document_type IN ('purchase_invoice', 'credit_note') THEN -inv.balance_due ELSE 0 END), 0) FROM contacts c JOIN invoices inv ON inv.contact_id = c.id WHERE c.contact_group_id = contact_groups.id AND c.deleted_at IS NULL AND inv.status NOT IN ('paid', 'cancelled', 'draft') AND inv.document_type IN ('sales_invoice', 'purchase_invoice', 'credit_note', 'debit_note'))
      `;
      
      const data = await db
        .select({
          id: contactGroups.id,
          orgId: contactGroups.orgId,
          name: contactGroups.name,
          createdAt: contactGroups.createdAt,
          updatedAt: contactGroups.updatedAt,
          balance: sql<number>`${balanceQuery}::numeric`.as('balance')
        })
        .from(contactGroups)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(
          (() => {
            if (options.sortBy && options.sortOrder) {
              const orderFn = options.sortOrder === 'desc' ? desc : asc;
              switch (options.sortBy) {
                case 'name': return orderFn(contactGroups.name);
                case 'balance': return orderFn(sql`${balanceQuery}`);
                case 'createdAt': return orderFn(contactGroups.createdAt);
              }
            }
            return asc(contactGroups.name);
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
    }

    const data = await db
      .select()
      .from(contactGroups)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        (() => {
          if (options.sortBy && options.sortOrder) {
            const orderFn = options.sortOrder === 'desc' ? desc : asc;
            switch (options.sortBy) {
              case 'name': return orderFn(contactGroups.name);
              case 'createdAt': return orderFn(contactGroups.createdAt);
            }
          }
          return asc(contactGroups.name);
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

  async getContactGroupById(orgId: string, id: string) {
    const [group] = await db
      .select()
      .from(contactGroups)
      .where(and(eq(contactGroups.orgId, orgId), eq(contactGroups.id, id), isNull(contactGroups.deletedAt)))
      .limit(1);

    if (!group) {
      throw ApiError.notFound('Contact group not found');
    }
    return group;
  },

  async createContactGroup(orgId: string, input: any) {
    // Ensure name uniqueness within org
    const [nameExists] = await db
      .select()
      .from(contactGroups)
      .where(and(eq(contactGroups.orgId, orgId), eq(contactGroups.name, input.name), isNull(contactGroups.deletedAt)))
      .limit(1);

    if (nameExists) {
      throw ApiError.badRequest('A contact group with this name already exists');
    }

    const [group] = await db
      .insert(contactGroups)
      .values({
        orgId,
        name: input.name,
        description: input.description || null,
        isActive: input.isActive ?? true,
      })
      .returning();

    return group;
  },

  async updateContactGroup(orgId: string, id: string, input: any) {
    await this.getContactGroupById(orgId, id);

    if (input.name) {
      // Ensure name uniqueness within org
      const [nameExists] = await db
        .select()
        .from(contactGroups)
        .where(and(eq(contactGroups.orgId, orgId), eq(contactGroups.name, input.name), isNull(contactGroups.deletedAt)))
        .limit(1);

      if (nameExists && nameExists.id !== id) {
        throw ApiError.badRequest('A contact group with this name already exists');
      }
    }

    const [group] = await db
      .update(contactGroups)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(contactGroups.orgId, orgId), eq(contactGroups.id, id)))
      .returning();

    return group;
  },

  async deleteContactGroup(orgId: string, id: string) {
    await this.getContactGroupById(orgId, id);

    await db.transaction(async (tx) => {
      // Soft-delete contact group
      await tx
        .update(contactGroups)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(contactGroups.orgId, orgId), eq(contactGroups.id, id)));

      // Nullify references in contacts table
      await tx.execute(sql`UPDATE "contacts" SET "contact_group_id" = NULL WHERE "contact_group_id" = ${id}`);
    });
  },

  // ─── HSN / SAC Codes ────────────────────────────────────────────────────────
  // ─── HSN / SAC Codes ────────────────────────────────────────────────────────
    async listHsnCodes(
    orgId: string,
    options: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const conditions: any[] = [
      eq(hsnCodes.orgId, orgId),
      isNull(hsnCodes.deletedAt),
    ];

    if (options.search) {
      conditions.push(
        or(
          ilike(hsnCodes.code, `%${options.search}%`),
          ilike(hsnCodes.description, `%${options.search}%`)
        ) as any
      );
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(hsnCodes)
      .where(whereClause);

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const data = await db
      .select({
        id: hsnCodes.id,
        orgId: hsnCodes.orgId,
        code: hsnCodes.code,
        description: hsnCodes.description,
        type: hsnCodes.type,
        taxRateId: hsnCodes.taxRateId,
        gstRate: taxRates.ratePercentage,
        createdAt: hsnCodes.createdAt,
        updatedAt: hsnCodes.updatedAt,
      })
      .from(hsnCodes)
      .leftJoin(taxRates, eq(hsnCodes.taxRateId, taxRates.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(
        (() => {
          if (options.sortBy && options.sortOrder) {
            const orderFn = options.sortOrder === 'desc' ? desc : asc;
            switch (options.sortBy) {
              case 'code': return orderFn(hsnCodes.code);
              case 'type': return orderFn(hsnCodes.type);
              case 'createdAt': return orderFn(hsnCodes.createdAt);
            }
          }
          return asc(hsnCodes.code);
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

  async getHsnCodeById(orgId: string, id: string) {
    const [hsn] = await db
      .select({
        id: hsnCodes.id,
        orgId: hsnCodes.orgId,
        code: hsnCodes.code,
        description: hsnCodes.description,
        type: hsnCodes.type,
        taxRateId: hsnCodes.taxRateId,
        gstRate: taxRates.ratePercentage,
        createdAt: hsnCodes.createdAt,
        updatedAt: hsnCodes.updatedAt,
      })
      .from(hsnCodes)
      .leftJoin(taxRates, eq(hsnCodes.taxRateId, taxRates.id))
      .where(and(eq(hsnCodes.orgId, orgId), eq(hsnCodes.id, id), isNull(hsnCodes.deletedAt)))
      .limit(1);

    if (!hsn) {
      throw ApiError.notFound('HSN/SAC code not found');
    }
    return hsn;
  },

  async createHsnCode(orgId: string, input: any) {
    // Ensure code uniqueness within org
    const [codeExists] = await db
      .select()
      .from(hsnCodes)
      .where(and(eq(hsnCodes.orgId, orgId), eq(hsnCodes.code, input.code), isNull(hsnCodes.deletedAt)))
      .limit(1);

    if (codeExists) {
      throw ApiError.badRequest('An HSN/SAC code with this code already exists');
    }

    const [hsn] = await db
      .insert(hsnCodes)
      .values({
        orgId,
        code: input.code,
        description: input.description,
        type: input.type as any,
        taxRateId: input.taxRateId,
      })
      .returning();

    // Fetch the tax rate to get the initial rate percentage for history
    const [taxRate] = await db
      .select()
      .from(taxRates)
      .where(and(eq(taxRates.orgId, orgId), eq(taxRates.id, input.taxRateId)))
      .limit(1);

    if (taxRate) {
      await db.insert(hsnRateHistory).values({
        orgId,
        hsnCodeId: hsn.id,
        previousRate: null,
        newRate: Number(taxRate.ratePercentage).toFixed(2),
        effectiveFrom: new Date().toISOString().split('T')[0],
        reason: 'Initial rate set on creation',
      });
    }

    return hsn;
  },

  async updateHsnCode(orgId: string, id: string, input: any) {
    await this.getHsnCodeById(orgId, id);

    if (input.code) {
      // Ensure code uniqueness within org
      const [codeExists] = await db
        .select()
        .from(hsnCodes)
        .where(and(eq(hsnCodes.orgId, orgId), eq(hsnCodes.code, input.code), isNull(hsnCodes.deletedAt)))
        .limit(1);

      if (codeExists && codeExists.id !== id) {
        throw ApiError.badRequest('An HSN/SAC code with this code already exists');
      }
    }

    const updateData: any = { updatedAt: new Date() };
    if (input.code !== undefined) updateData.code = input.code;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.taxRateId !== undefined) updateData.taxRateId = input.taxRateId;

    const [hsn] = await db
      .update(hsnCodes)
      .set(updateData)
      .where(and(eq(hsnCodes.orgId, orgId), eq(hsnCodes.id, id)))
      .returning();

    if (input.taxRateId !== undefined) {
      await db
        .update(products)
        .set({ taxRateId: input.taxRateId, isTaxable: true, updatedAt: new Date() })
        .where(and(eq(products.orgId, orgId), eq(products.hsnCodeId, id)));
    }

    return hsn;
  },

  async updateHsnRate(orgId: string, id: string, input: any, userId?: string) {
    const existing = await this.getHsnCodeById(orgId, id);

    // Fetch the new tax rate
    const [newTaxRate] = await db
      .select()
      .from(taxRates)
      .where(and(eq(taxRates.orgId, orgId), eq(taxRates.id, input.newTaxRateId)))
      .limit(1);

    if (!newTaxRate) {
      throw ApiError.notFound('Tax rate not found');
    }

    const newRate = Number(newTaxRate.ratePercentage).toFixed(2);

    // Insert history record
    await db.insert(hsnRateHistory).values({
      orgId,
      hsnCodeId: id,
      previousRate: existing.gstRate,
      newRate,
      effectiveFrom: input.effectiveFrom,
      reason: input.reason || null,
      changedBy: userId || null,
    });

    // Update the taxRateId on the HSN code
    const [hsn] = await db
      .update(hsnCodes)
      .set({ taxRateId: input.newTaxRateId, updatedAt: new Date() })
      .where(and(eq(hsnCodes.orgId, orgId), eq(hsnCodes.id, id)))
      .returning();

    // Cascade update to all products using this HSN code
    await db
      .update(products)
      .set({ taxRateId: input.newTaxRateId, isTaxable: true, updatedAt: new Date() })
      .where(and(eq(products.orgId, orgId), eq(products.hsnCodeId, id)));

    return hsn;
  },

  async deleteHsnCode(orgId: string, id: string) {
    await this.getHsnCodeById(orgId, id);

    // Check if any product is using this HSN code
    const [linkedProduct] = await db
      .select()
      .from(products)
      .where(and(eq(products.orgId, orgId), eq(products.hsnCodeId, id), isNull(products.deletedAt)))
      .limit(1);

    if (linkedProduct) {
      throw ApiError.badRequest('Cannot delete HSN/SAC code because it is currently linked to one or more products');
    }

    const [hsn] = await db
      .update(hsnCodes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(hsnCodes.orgId, orgId), eq(hsnCodes.id, id)))
      .returning();

    return hsn;
  },

  async getHsnRateHistory(orgId: string, hsnCodeId: string) {
    await this.getHsnCodeById(orgId, hsnCodeId);

    return await db
      .select()
      .from(hsnRateHistory)
      .where(and(eq(hsnRateHistory.orgId, orgId), eq(hsnRateHistory.hsnCodeId, hsnCodeId)))
      .orderBy(desc(hsnRateHistory.createdAt));
  },
};
