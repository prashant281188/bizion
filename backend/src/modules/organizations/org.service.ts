import { db } from '../../db/index.js';
import { organizations } from '../../db/schema/organizations.js';
import { ApiError } from '../../utils/api-error.js';
import { eq } from 'drizzle-orm';
import type { UpdateOrgInput } from './org.schema.js';
import { cacheService } from '../../utils/cache.js';

export const orgService = {
  /**
   * Get organization by ID.
   */
  async getOrgById(orgId: string) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) {
      throw ApiError.notFound('Organization not found');
    }

    return org;
  },

  /**
   * Update organization details.
   */
  async updateOrg(orgId: string, input: UpdateOrgInput) {
    // Check if organization exists
    const existing = await this.getOrgById(orgId);

    const [updatedOrg] = await db
      .update(organizations)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning();

    // Invalidate public caches for this organization
    try {
      if (existing.slug) {
        await cacheService.invalidatePattern(`*${existing.slug}*`);
      }
      if (updatedOrg?.slug && updatedOrg.slug !== existing.slug) {
        await cacheService.invalidatePattern(`*${updatedOrg.slug}*`);
      }
    } catch (err) {
      console.error('Failed to invalidate organization cache:', err);
    }

    return updatedOrg;
  },
};
