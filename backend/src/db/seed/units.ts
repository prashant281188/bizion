import { Database } from '../index.js';
import { unitsOfMeasurement } from '../schema/masters.js';

export async function seedUnits(db: Database, orgId: string) {
  console.log('Seeding units of measurement...');

  const units = [
    {
      orgId,
      code: 'PCS',
      name: 'PIECES',
      uqcCode: 'PCS',
      isDefault: true,
    },
    {
      orgId,
      code: 'KGS',
      name: 'KILOGRAMS',
      uqcCode: 'KGS',
      isDefault: false,
    },
    {
      orgId,
      code: 'NOS',
      name: 'NUMBERS',
      uqcCode: 'NOS',
      isDefault: false,
    },
    {
      orgId,
      code: 'LTR',
      name: 'LITRE',
      uqcCode: 'KLR',
      isDefault: false,
    },
    {
      orgId,
      code: 'MTR',
      name: 'METRES',
      uqcCode: 'MTR',
      isDefault: false,
    },
    {
      orgId,
      code: 'BOX',
      name: 'BOX',
      uqcCode: 'BOX',
      isDefault: false,
    },
    {
      orgId,
      code: 'DOZ',
      name: 'DOZEN',
      uqcCode: 'DOZ',
      isDefault: false,
    },
    {
      orgId,
      code: 'BAG',
      name: 'BAGS',
      uqcCode: 'BAG',
      isDefault: false,
    },
    {
      orgId,
      code: 'SET',
      name: 'SETS',
      uqcCode: 'SET',
      isDefault: false,
    },
    {
      orgId,
      code: 'PRS',
      name: 'PAIRS',
      uqcCode: 'PRS',
      isDefault: false,
    },
  ];

  await db.insert(unitsOfMeasurement).values(units).onConflictDoNothing();
  console.log('✅ Units of measurement seeded.');
}
