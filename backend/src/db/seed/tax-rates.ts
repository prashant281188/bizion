import { Database } from '../index.js';
import { taxRates } from '../schema/masters.js';

export async function seedTaxRates(db: Database, orgId: string) {
  console.log('Seeding tax rates...');
  
  const rates = [
    {
      orgId,
      name: 'GST 0% (Exempt)',
      ratePercentage: '0.00',
      cgstRate: '0.00',
      sgstRate: '0.00',
      igstRate: '0.00',
      cessRate: '0.00',
      isDefault: true,
      isActive: true,
    },
    {
      orgId,
      name: 'GST 5%',
      ratePercentage: '5.00',
      cgstRate: '2.50',
      sgstRate: '2.50',
      igstRate: '5.00',
      cessRate: '0.00',
      isDefault: false,
      isActive: true,
    },
    {
      orgId,
      name: 'GST 12%',
      ratePercentage: '12.00',
      cgstRate: '6.00',
      sgstRate: '6.00',
      igstRate: '12.00',
      cessRate: '0.00',
      isDefault: false,
      isActive: true,
    },
    {
      orgId,
      name: 'GST 18%',
      ratePercentage: '18.00',
      cgstRate: '9.00',
      sgstRate: '9.00',
      igstRate: '18.00',
      cessRate: '0.00',
      isDefault: false,
      isActive: true,
    },
    {
      orgId,
      name: 'GST 28%',
      ratePercentage: '28.00',
      cgstRate: '14.00',
      sgstRate: '14.00',
      igstRate: '28.00',
      cessRate: '0.00',
      isDefault: false,
      isActive: true,
    },
  ];

  await db.insert(taxRates).values(rates).onConflictDoNothing();
  console.log('✅ Tax rates seeded.');
}
