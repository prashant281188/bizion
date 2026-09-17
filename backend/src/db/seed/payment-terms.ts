import { Database } from '../index.js';
import { paymentTerms } from '../schema/masters.js';

export async function seedPaymentTerms(db: Database, orgId: string) {
  console.log('Seeding payment terms...');

  const terms = [
    {
      orgId,
      name: 'Cash on Delivery (COD)',
      dueDays: 0,
      isDefault: true,
    },
    {
      orgId,
      name: 'Due on Receipt',
      dueDays: 0,
      isDefault: false,
    },
    {
      orgId,
      name: 'Net 15 Days',
      dueDays: 15,
      isDefault: false,
    },
    {
      orgId,
      name: 'Net 30 Days',
      dueDays: 30,
      isDefault: false,
    },
    {
      orgId,
      name: 'Net 45 Days',
      dueDays: 45,
      isDefault: false,
    },
    {
      orgId,
      name: 'Net 60 Days',
      dueDays: 60,
      isDefault: false,
    },
  ];

  await db.insert(paymentTerms).values(terms).onConflictDoNothing();
  console.log('✅ Payment terms seeded.');
}
