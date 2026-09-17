import { db } from '../../db/index.js';
import { transporters } from '../../db/schema/masters.js';
import { eq, and, isNull, desc } from 'drizzle-orm';

export interface CreateTransporterInput {
  name: string;
  code?: string;
  transporterId?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  vehicleNumber?: string;
  remarks?: string;
  isActive?: boolean;
}

export interface UpdateTransporterInput extends Partial<CreateTransporterInput> {}

export class TransportersService {
  async listTransporters(orgId: string) {
    return db
      .select()
      .from(transporters)
      .where(and(eq(transporters.orgId, orgId), isNull(transporters.deletedAt)))
      .orderBy(desc(transporters.createdAt));
  }

  async getTransporter(orgId: string, id: string) {
    const [row] = await db
      .select()
      .from(transporters)
      .where(
        and(
          eq(transporters.id, id),
          eq(transporters.orgId, orgId),
          isNull(transporters.deletedAt)
        )
      );
    return row || null;
  }

  async createTransporter(orgId: string, input: CreateTransporterInput) {
    const [row] = await db
      .insert(transporters)
      .values({
        orgId,
        name: input.name,
        code: input.code || undefined,
        transporterId: input.transporterId || undefined,
        gstin: input.gstin || input.transporterId || undefined,
        phone: input.phone || undefined,
        email: input.email || undefined,
        vehicleNumber: input.vehicleNumber || undefined,
        remarks: input.remarks || undefined,
        isActive: input.isActive !== false,
      })
      .returning();

    return row;
  }

  async updateTransporter(orgId: string, id: string, input: UpdateTransporterInput) {
    const [row] = await db
      .update(transporters)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.code !== undefined && { code: input.code }),
        ...(input.transporterId !== undefined && { transporterId: input.transporterId }),
        ...(input.gstin !== undefined && { gstin: input.gstin }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.email !== undefined && { email: input.email }),
        ...(input.vehicleNumber !== undefined && { vehicleNumber: input.vehicleNumber }),
        ...(input.remarks !== undefined && { remarks: input.remarks }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(transporters.id, id),
          eq(transporters.orgId, orgId),
          isNull(transporters.deletedAt)
        )
      )
      .returning();

    return row || null;
  }

  async deleteTransporter(orgId: string, id: string) {
    const [row] = await db
      .update(transporters)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(transporters.id, id),
          eq(transporters.orgId, orgId),
          isNull(transporters.deletedAt)
        )
      )
      .returning();

    return row || null;
  }
}

export const transportersService = new TransportersService();
