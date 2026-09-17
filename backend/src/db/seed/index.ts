import bcrypt from 'bcryptjs';
import { db, closeDatabase } from '../index.js';
import { organizations } from '../schema/organizations.js';
import { users } from '../schema/users.js';
import { seedTaxRates } from './tax-rates.js';
import { seedUnits } from './units.js';
import { seedHsnCodes } from './hsn-codes.js';
import { seedPaymentTerms } from './payment-terms.js';
import { seedChartOfAccounts } from './chart-of-accounts.js';
import { eq } from 'drizzle-orm';

const SEED_ORG_ID = 'd3b07384-d113-4956-a574-8b6fa292723d';
const SEED_USER_ID = 'a7b07384-d113-4956-a574-8b6fa292723e';

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // 1. Create Default Organization
    console.log('Checking for default organization...');
    const existingOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, SEED_ORG_ID));

    if (existingOrg.length === 0) {
      console.log('Creating demo organization...');
      await db.insert(organizations).values({
        id: SEED_ORG_ID,
        name: 'Bizion Demo Corp',
        legalName: 'Bizion Technologies Private Limited',
        slug: 'bizion-demo',
        gstin: '27AAAAA1111A1Z1', // Maharashtra GSTIN format
        gstRegistrationType: 'regular',
        pan: 'AAAAA1111A',
        addressLine1: '101, Horizon Heights, Bandra Kurla Complex',
        city: 'Mumbai',
        stateCode: '27',
        stateName: 'Maharashtra',
        pincode: '400051',
        country: 'India',
        email: 'info@bizion.com',
        phone: '022-44445555',
        status: 'active',
        plan: 'growth',
      });
      console.log('✅ Demo organization created.');
    } else {
      console.log('ℹ️ Demo organization already exists.');
    }

    // 2. Create Default Admin User
    console.log('Checking for default admin user...');
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, SEED_USER_ID));

    if (existingUser.length === 0) {
      console.log('Creating admin user...');
      const passwordHash = await bcrypt.hash('admin123', 10);
      await db.insert(users).values({
        id: SEED_USER_ID,
        orgId: SEED_ORG_ID,
        email: 'admin@bizion.com',
        passwordHash,
        firstName: 'Bizion',
        lastName: 'Admin',
        phone: '9876543210',
        role: 'owner',
        status: 'active',
        emailVerifiedAt: new Date(),
      });
      console.log('✅ Admin user created. (admin@bizion.com / admin123)');
    } else {
      console.log('ℹ️ Admin user already exists.');
    }

    // 3. Run individual seeders
    await seedTaxRates(db, SEED_ORG_ID);
    await seedUnits(db, SEED_ORG_ID);
    await seedHsnCodes(db, SEED_ORG_ID);
    await seedPaymentTerms(db, SEED_ORG_ID);
    await seedChartOfAccounts(db, SEED_ORG_ID);

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed with error:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
    process.exit(0);
  }
}

main();
