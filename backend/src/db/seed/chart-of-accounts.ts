import { Database } from '../index.js';
import { accounts } from '../schema/accounting.js';
import { eq, and } from 'drizzle-orm';

export async function seedChartOfAccounts(db: Database, orgId: string) {
  console.log('Seeding Chart of Accounts...');

  // 1. Seed Top-Level Parent Accounts
  const parentAccounts = [
    { orgId, code: '1000', name: 'Current Assets', type: 'asset' as const, isSystem: true, description: 'Assets that are expected to be converted to cash within one year' },
    { orgId, code: '1400', name: 'Fixed Assets', type: 'asset' as const, isSystem: true, description: 'Long-term tangible assets used in business operations' },
    { orgId, code: '2000', name: 'Current Liabilities', type: 'liability' as const, isSystem: true, description: 'Obligations due within one year' },
    { orgId, code: '2200', name: 'Long-Term Liabilities', type: 'liability' as const, isSystem: true, description: 'Obligations due after one year' },
    { orgId, code: '3000', name: 'Equity', type: 'equity' as const, isSystem: true, description: 'Owner\'s residual interest in the business' },
    { orgId, code: '4000', name: 'Revenue', type: 'revenue' as const, isSystem: true, description: 'Income generated from sales of goods/services' },
    { orgId, code: '5000', name: 'Direct Expenses', type: 'expense' as const, isSystem: true, description: 'Costs directly related to the production of goods/services' },
    { orgId, code: '5100', name: 'Operating Expenses', type: 'expense' as const, isSystem: true, description: 'Indirect costs required to run the day-to-day business' },
  ];

  await db.insert(accounts).values(parentAccounts).onConflictDoNothing();

  // Fetch the inserted parent accounts to get their auto-generated UUIDs
  const insertedParents = await db
    .select()
    .from(accounts)
    .where(eq(accounts.orgId, orgId));

  const getParentIdByCode = (code: string) => {
    return insertedParents.find((acc) => acc.code === code)?.id || null;
  };

  const currentAssetsId = getParentIdByCode('1000');
  const fixedAssetsId = getParentIdByCode('1400');
  const currentLiabilitiesId = getParentIdByCode('2000');
  const equityId = getParentIdByCode('3000');
  const revenueId = getParentIdByCode('4000');
  const directExpensesId = getParentIdByCode('5000');
  const operatingExpensesId = getParentIdByCode('5100');

  // 2. Seed Child Accounts
  const childAccounts = [
    // Under Current Assets
    {
      orgId,
      code: '1010',
      name: 'Cash in Hand',
      type: 'asset' as const,
      parentId: currentAssetsId,
      isSystem: true,
      description: 'Physical cash held by the business',
    },
    {
      orgId,
      code: '1020',
      name: 'Bank Account (Main)',
      type: 'asset' as const,
      parentId: currentAssetsId,
      isSystem: true,
      description: 'Primary corporate bank account',
    },
    {
      orgId,
      code: '1030',
      name: 'Accounts Receivable (Sundry Debtors)',
      type: 'asset' as const,
      parentId: currentAssetsId,
      isSystem: true,
      description: 'Amounts owed by customers for sales on credit',
    },
    {
      orgId,
      code: '1040',
      name: 'Inventory (Stock-in-hand)',
      type: 'asset' as const,
      parentId: currentAssetsId,
      isSystem: true,
      description: 'Value of raw materials and finished goods in stock',
    },
    {
      orgId,
      code: '1050',
      name: 'CGST Input Tax Credit (ITC)',
      type: 'asset' as const,
      parentId: currentAssetsId,
      isSystem: true,
      description: 'Input tax credit receivable for CGST paid on purchases',
    },
    {
      orgId,
      code: '1060',
      name: 'SGST Input Tax Credit (ITC)',
      type: 'asset' as const,
      parentId: currentAssetsId,
      isSystem: true,
      description: 'Input tax credit receivable for SGST paid on purchases',
    },
    {
      orgId,
      code: '1070',
      name: 'IGST Input Tax Credit (ITC)',
      type: 'asset' as const,
      parentId: currentAssetsId,
      isSystem: true,
      description: 'Input tax credit receivable for IGST paid on purchases',
    },

    // Under Fixed Assets
    {
      orgId,
      code: '1410',
      name: 'Computers & Equipment',
      type: 'asset' as const,
      parentId: fixedAssetsId,
      isSystem: false,
      description: 'Office laptops, routers, printers',
    },
    {
      orgId,
      code: '1420',
      name: 'Office Furniture',
      type: 'asset' as const,
      parentId: fixedAssetsId,
      isSystem: false,
      description: 'Desks, chairs, filing cabinets',
    },

    // Under Current Liabilities
    {
      orgId,
      code: '2010',
      name: 'Accounts Payable (Sundry Creditors)',
      type: 'liability' as const,
      parentId: currentLiabilitiesId,
      isSystem: true,
      description: 'Amounts owed to vendors for purchases on credit',
    },
    {
      orgId,
      code: '2020',
      name: 'CGST Output Tax Liability',
      type: 'liability' as const,
      parentId: currentLiabilitiesId,
      isSystem: true,
      description: 'Tax collected on sales payable to Central Government',
    },
    {
      orgId,
      code: '2030',
      name: 'SGST Output Tax Liability',
      type: 'liability' as const,
      parentId: currentLiabilitiesId,
      isSystem: true,
      description: 'Tax collected on sales payable to State Government',
    },
    {
      orgId,
      code: '2040',
      name: 'IGST Output Tax Liability',
      type: 'liability' as const,
      parentId: currentLiabilitiesId,
      isSystem: true,
      description: 'Tax collected on interstate sales payable to Central Government',
    },

    // Under Equity
    {
      orgId,
      code: '3010',
      name: 'Owner\'s Capital',
      type: 'equity' as const,
      parentId: equityId,
      isSystem: true,
      description: 'Initial and subsequent investments by the owner',
    },
    {
      orgId,
      code: '3020',
      name: 'Retained Earnings',
      type: 'equity' as const,
      parentId: equityId,
      isSystem: true,
      description: 'Accumulated profits not distributed to owners',
    },

    // Under Revenue
    {
      orgId,
      code: '4010',
      name: 'Sales (Goods)',
      type: 'revenue' as const,
      parentId: revenueId,
      isSystem: true,
      description: 'Revenue from selling products',
    },
    {
      orgId,
      code: '4020',
      name: 'Sales (Services)',
      type: 'revenue' as const,
      parentId: revenueId,
      isSystem: true,
      description: 'Revenue from provisioning services',
    },
    {
      orgId,
      code: '4030',
      name: 'Discounts Received',
      type: 'revenue' as const,
      parentId: revenueId,
      isSystem: false,
      description: 'Discounts given by suppliers',
    },

    // Under Direct Expenses
    {
      orgId,
      code: '5010',
      name: 'Cost of Goods Sold (COGS)',
      type: 'expense' as const,
      parentId: directExpensesId,
      isSystem: true,
      description: 'Direct cost of inventory sold',
    },
    {
      orgId,
      code: '5020',
      name: 'Freight & Carriage Inward',
      type: 'expense' as const,
      parentId: directExpensesId,
      isSystem: false,
      description: 'Transport costs for purchasing inventory',
    },

    // Under Operating Expenses
    {
      orgId,
      code: '5110',
      name: 'Salaries & Wages',
      type: 'expense' as const,
      parentId: operatingExpensesId,
      isSystem: false,
      description: 'Employee payroll costs',
    },
    {
      orgId,
      code: '5120',
      name: 'Office Rent',
      type: 'expense' as const,
      parentId: operatingExpensesId,
      isSystem: false,
      description: 'Rent paid for office space',
    },
    {
      orgId,
      code: '5130',
      name: 'Internet & Electricity',
      type: 'expense' as const,
      parentId: operatingExpensesId,
      isSystem: false,
      description: 'Utility bills',
    },
    {
      orgId,
      code: '5140',
      name: 'Discounts Allowed',
      type: 'expense' as const,
      parentId: operatingExpensesId,
      isSystem: false,
      description: 'Discounts given to customers',
    },
    {
      orgId,
      code: '5150',
      name: 'Depreciation Expense',
      type: 'expense' as const,
      parentId: operatingExpensesId,
      isSystem: true,
      description: 'Annual write-off of fixed asset value',
    },
  ];

  await db.insert(accounts).values(childAccounts).onConflictDoNothing();
  console.log('✅ Chart of Accounts seeded.');
}
