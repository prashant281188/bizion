import { Database } from '../index.js';
import { hsnCodes, taxRates } from '../schema/masters.js';
import { eq, and } from 'drizzle-orm';

export async function seedHsnCodes(db: Database, orgId: string) {
  console.log('Seeding HSN codes...');

  // Fetch standard 18% tax rate to bind as default
  const defaultRate = await db.query.taxRates.findFirst({
    where: and(eq(taxRates.orgId, orgId), eq(taxRates.ratePercentage, '18.00')),
  });

  if (!defaultRate) {
    console.log('⚠️ No default 18% tax rate found, skipping HSN seeding.');
    return;
  }

  const defaultHsn = [
    {
      orgId,
      code: '8302',
      description: 'Base metal mountings, fittings and similar articles suitable for furniture, doors, staircases, windows, blinds',
      type: 'goods' as const,
      taxRateId: defaultRate.id,
    },
    {
      orgId,
      code: '9983',
      description: 'Other professional, technical and business services',
      type: 'services' as const,
      taxRateId: defaultRate.id,
    },
  ];

  await db.insert(hsnCodes).values(defaultHsn).onConflictDoNothing();
  console.log('✅ HSN codes seeded.');
}
