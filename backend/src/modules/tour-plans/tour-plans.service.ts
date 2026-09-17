import { db } from '../../config/database.js';
import { tourPlans } from '../../db/schema/tour-plans.js';
import { eq, and, desc } from 'drizzle-orm';

export class TourPlansService {
  async listTourPlans(orgId: string, month?: string, year?: string) {
    const conditions = [eq(tourPlans.orgId, orgId)];
    if (month) conditions.push(eq(tourPlans.month, month));
    if (year) conditions.push(eq(tourPlans.year, year));

    return await db
      .select()
      .from(tourPlans)
      .where(and(...conditions))
      .orderBy(desc(tourPlans.createdAt));
  }

  async getTourPlan(id: string, orgId: string) {
    const [plan] = await db
      .select()
      .from(tourPlans)
      .where(and(eq(tourPlans.id, id), eq(tourPlans.orgId, orgId)));
    return plan || null;
  }

  async createTourPlan(orgId: string, data: any) {
    const id = data.id || `tour_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const [newPlan] = await db
      .insert(tourPlans)
      .values({
        id,
        orgId,
        name: data.name,
        month: data.month,
        year: String(data.year),
        cities: data.cities || [],
        plannedVisitIds: data.plannedVisitIds || [],
        dateVisits: data.dateVisits || [],
        notes: data.notes || null,
      })
      .returning();
    return newPlan;
  }

  async updateTourPlan(id: string, orgId: string, data: any) {
    const [updated] = await db
      .update(tourPlans)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.month && { month: data.month }),
        ...(data.year && { year: String(data.year) }),
        ...(data.cities && { cities: data.cities }),
        ...(data.plannedVisitIds && { plannedVisitIds: data.plannedVisitIds }),
        ...(data.dateVisits !== undefined && { dateVisits: data.dateVisits }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updatedAt: new Date(),
      })
      .where(and(eq(tourPlans.id, id), eq(tourPlans.orgId, orgId)))
      .returning();
    return updated || null;
  }

  async deleteTourPlan(id: string, orgId: string) {
    const [deleted] = await db
      .delete(tourPlans)
      .where(and(eq(tourPlans.id, id), eq(tourPlans.orgId, orgId)))
      .returning();
    return deleted || null;
  }
}

export const tourPlansService = new TourPlansService();
