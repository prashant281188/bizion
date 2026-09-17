import { db, closeDatabase } from '../index.js';
import {
  categories,
  brands,
  products,
  productVariants,
  productVariantPriceHistory,
  taxRates,
  hsnCodes,
  unitsOfMeasurement,
  invoices,
  invoiceLineItems,
  invoiceAttachments,
  orders,
  orderItems,
  inventory,
  inventoryTransactions,
  payments,
  paymentAllocations,
  gstReturnPeriods,
  gstr1Data,
  gstr3bData,
  hsnSummary,
  warehouses
} from '../schema/index.js';
import { eq, sql } from 'drizzle-orm';

const SEED_ORG_ID = 'd3b07384-d113-4956-a574-8b6fa292723d';
const SEED_USER_ID = 'a7b07384-d113-4956-a574-8b6fa292723e';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') 
    .replace(/[^\w\-]+/g, '') 
    .replace(/\-\-+/g, '-');
}

function generateVariantSku(productName: string, attributes: any): string {
  const sortedKeys = Object.keys(attributes || {}).sort();
  const vals = sortedKeys.map(k => String(attributes[k]).trim()).filter(Boolean);
  const cleanName = productName.trim().replace(/\s+/g, '-');
  const cleanVals = vals.map(v => v.replace(/\s+/g, '-'));
  return [cleanName, ...cleanVals]
    .join('-')
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .toUpperCase();
}

interface CategoryTemplate {
  name: string;
  parentName: string | null;
}

interface BrandTemplate {
  name: string;
}

interface ProductTemplate {
  categoryName: string;
  parentCategoryName: string;
  brandName: string;
  adjectives: string[];
  types: string[];
  desc: string;
}

const CATEGORIES_TO_SEED: CategoryTemplate[] = [
  { name: 'Kitchen Fittings', parentName: null },
  { name: 'Wardrobe Hardware', parentName: null },
  { name: 'Locks & Security', parentName: null },
  { name: 'Drawer Slides', parentName: 'Kitchen Fittings' },
  { name: 'Hinges & Flaps', parentName: 'Kitchen Fittings' },
  { name: 'Pantry Systems', parentName: 'Kitchen Fittings' },
  { name: 'Wardrobe Organizers', parentName: 'Wardrobe Hardware' },
  { name: 'LED Lighting Profiles', parentName: 'Wardrobe Hardware' },
  { name: 'Digital Locks', parentName: 'Locks & Security' },
  { name: 'Mortise Handles & Locks', parentName: 'Locks & Security' },
  { name: 'Padlocks', parentName: 'Locks & Security' }
];

const BRANDS_TO_SEED: BrandTemplate[] = [
  { name: 'Hafele' },
  { name: 'Hettich' },
  { name: 'Blum' },
  { name: 'Yale' },
  { name: 'Ebco' },
  { name: 'Sugatsune' },
  { name: 'Godrej' }
];

const PRODUCT_TEMPLATES: ProductTemplate[] = [
  {
    categoryName: 'Drawer Slides',
    parentCategoryName: 'Kitchen Fittings',
    brandName: 'Hettich',
    adjectives: ['Actro 5D', 'Quadro V6', 'KA 5632', 'Quadro 25', 'InnoTech Atira'],
    types: ['Silent System', 'Partial Extension', 'Ball Bearing Runner', 'Full Extension Drawer', 'Push-to-Open Runner'],
    desc: 'High precision drawer runners with integrated dampening for silent and effortless closing.'
  },
  {
    categoryName: 'Drawer Slides',
    parentCategoryName: 'Kitchen Fittings',
    brandName: 'Blum',
    adjectives: ['Tandembox Antaro', 'Legrabox Pure', 'Movento Sensation', 'Metabox Standard', 'Tandem Hook-in'],
    types: ['Tip-On Blumotion', 'Orga-Line Organizer Drawer', 'Inner Pull-out Runner', 'High Front Extension Drawer', 'Single Extension Runner'],
    desc: 'Premium drawer systems designed to coordinate perfectly with modern kitchen cabinets.'
  },
  {
    categoryName: 'Drawer Slides',
    parentCategoryName: 'Kitchen Fittings',
    brandName: 'Ebco',
    adjectives: ['Telescopic TS-45', 'Heavy Duty HD-75', 'Push-to-Open PO-45', 'Bottom-Mount BM-30', 'Stainless Steel SS-45'],
    types: ['Ball Bearing Drawer Slide', 'Cargo Runner 120kg', 'Soft-Close Telescopic Slide', 'Single Extension Track', 'Keyboard Tray Runner'],
    desc: 'Cost-effective, durable telescopic slides featuring smooth movements and high load capacity.'
  },
  {
    categoryName: 'Hinges & Flaps',
    parentCategoryName: 'Kitchen Fittings',
    brandName: 'Hafele',
    adjectives: ['Metalla 310', 'Duomatic Premium', 'Free Flap 1.7', 'Aventos HF', 'Silentia Soft-Close'],
    types: ['Concealed Cup Hinge', '110-Degree Corner Hinge', 'Bi-Fold Lift Up Flap System', 'Stay Flap Fitting', 'Glass Door Pivot Hinge'],
    desc: 'German-engineered hinges and lift fittings providing exceptional lifetime durability.'
  },
  {
    categoryName: 'Hinges & Flaps',
    parentCategoryName: 'Kitchen Fittings',
    brandName: 'Blum',
    adjectives: ['Clip Top Blumotion', 'Aventos HS', 'Aventos HK-XS', 'Modul Standard', 'Aventos HL'],
    types: ['110 Degree Hinge', 'Up & Over Lift System', 'Tip-On Concealed Hinge', 'Standard overlay hinge', 'Vertical Lift Up System'],
    desc: 'Internationally recognized hinge and lift systems for maximum convenience and functionality.'
  },
  {
    categoryName: 'Hinges & Flaps',
    parentCategoryName: 'Kitchen Fittings',
    brandName: 'Sugatsune',
    adjectives: ['Olympia Soft-Close', 'Lapcon Stay', 'HES3D Concealed', 'Aileron Hinge', 'GS-V Series'],
    types: ['3-Way Adjustable Hinge', 'Lift-Assist Damper Stay', 'Heavy Duty Pivot Door Hinge', 'Glass Showcase Lock Hinge', 'Drop-Down Flap Damper'],
    desc: 'Innovative Japanese hardware utilizing motion control technology for premium touchpoints.'
  },
  {
    categoryName: 'Pantry Systems',
    parentCategoryName: 'Kitchen Fittings',
    brandName: 'Hafele',
    adjectives: ['Arena Classic', 'Pleno Pull-Out', 'Lavido Tall Pantry', 'LeMans II Corner', 'Kessebohmer Tandem'],
    types: ['Pull-Out Pantry Unit', 'Corner Carousel Basket System', 'Swing-Out Tall Unit', 'Under-Counter Pullout Basket', 'Magic Corner Slide'],
    desc: 'Intelligent storage organizers maximizing kitchen cabinet usage and inventory accessibility.'
  },
  {
    categoryName: 'Pantry Systems',
    parentCategoryName: 'Kitchen Fittings',
    brandName: 'Hettich',
    adjectives: ['Cargo Larder', 'Dispensa Swing', 'Comfort Pull-Out', 'WingLine L Fold', 'InnoTech Larder'],
    types: ['Tall Unit Pull-out Rack', 'Revolving Corner Basket', 'Slimline Bottle Pull-out', 'Folding Door Larder System', 'Wire Mesh Pantry Basket'],
    desc: 'Premium space management modules engineered to bring hidden goods directly into view.'
  },
  {
    categoryName: 'Wardrobe Organizers',
    parentCategoryName: 'Wardrobe Hardware',
    brandName: 'Ebco',
    adjectives: ['Pull-out Shoe Rack', 'Trouser Organizer', 'Tie & Belt Rack', 'W-Series Wardrobe Hanger', 'Soft-Close Laundry Basket'],
    types: ['Slide-out Fitting', '10-Bar Trouser Rail', 'Rotating Tie Hanger', 'Pull-Down Wardrobe Hanger Lift', 'Wire Grid Storage Drawer'],
    desc: 'Modern wardrobe pull-outs ensuring organized clothing storage with smooth slide action.'
  },
  {
    categoryName: 'Wardrobe Organizers',
    parentCategoryName: 'Wardrobe Hardware',
    brandName: 'Hettich',
    adjectives: ['OrgaWeb Basket', 'Slide-Line Hanger', 'Trouser Pull-out Pro', 'Sensys Wardrobe Clip', 'Multi-Purpose Swivel Hook'],
    types: ['Felt-Lined Jewelry Tray', 'Pull-out Cosmetic Organizer', 'Shoe Rack Extension Frame', 'LED Wardrobe Rail Mount', 'Adjustable Clothes Hanger Hook'],
    desc: 'Bespoke organization trays and fittings for customizable internal wardrobe storage.'
  },
  {
    categoryName: 'LED Lighting Profiles',
    parentCategoryName: 'Wardrobe Hardware',
    brandName: 'Ebco',
    adjectives: ['Profile LP-12', 'Recessed Profile RP-18', 'Corner Profile CP-10', 'Wardrobe Rail WP-25', 'Surface Mount SP-08'],
    types: ['Anodized Aluminum LED Channel', 'Diffuser Lens Lighting Profile', '90-Degree LED Corner Profile', 'Lighted Hanging Wardrobe Rail', 'Ultra-Slim Under-Cabinet Channel'],
    desc: 'Precision extruded aluminum channels for hosting decorative and ambient LED light strips.'
  },
  {
    categoryName: 'LED Lighting Profiles',
    parentCategoryName: 'Wardrobe Hardware',
    brandName: 'Hafele',
    adjectives: ['Loox Profile 2101', 'Loox Surface Channel', 'Loox Glass Edge Profile', 'Loox Wardrobe Rail 3015', 'Loox Flexible Silicone Profile'],
    types: ['Recessed LED Profile with Diffuser', 'Milky Lens Lighting Mount', 'Glass Shelf Edge Clip LED Profile', 'Sensor Activated Wardrobe Light Rail', 'Corner Mount LED Lighting Channel'],
    desc: 'Plug-and-play architectural lighting profiles designed to highlight cabinets and shelves.'
  },
  {
    categoryName: 'Digital Locks',
    parentCategoryName: 'Locks & Security',
    brandName: 'Yale',
    adjectives: ['YDM 4109+', 'YDR 3110', 'YDM 7116', 'Luna Smart Lock', 'YDM 3109 Keyless'],
    types: ['Biometric Smart Door Lock', 'PIN Code & RFID Card Rim Lock', 'Fingerprint & Mechanical Key Handle Lock', 'Face Recognition Smart Lock', 'Bluetooth Enabled Cabinet Lock'],
    desc: 'State-of-the-art security locks with fingerprint, keypad, card, and smartphone credentials.'
  },
  {
    categoryName: 'Digital Locks',
    parentCategoryName: 'Locks & Security',
    brandName: 'Godrej',
    adjectives: ['Advantis Rim', 'Catus Touch', 'Advantis Technos', 'Sherlock Digital', 'Solus Smart Home'],
    types: ['Electronic Keypad Rim Lock', 'Touchscreen Smart Locker Lock', 'Fingerprint Digital Door Lock', 'App-Controlled Main Door Lock', 'RFID Card Operated Locker Lock'],
    desc: 'High-security electronic locks providing advanced biometric access logs and tamper alarms.'
  },
  {
    categoryName: 'Mortise Handles & Locks',
    parentCategoryName: 'Locks & Security',
    brandName: 'Yale',
    adjectives: ['Essential Brass Handle', 'Luxury Zinc Alloy Pull', 'Euro-Profile Cylindrical', 'Heavy Duty Mortise Lockcase', 'Classic Leverset Lock'],
    types: ['Mortise Handle Set', 'Premium Finish Lever Lock', 'Double Cylinder Lockcase', 'Deadbolt Entry Handle Set', 'Bathroom Privacy Lock Set'],
    desc: 'Elegant mechanical door locks with hardened steel bolts and premium brass keyways.'
  },
  {
    categoryName: 'Mortise Handles & Locks',
    parentCategoryName: 'Locks & Security',
    brandName: 'Godrej',
    adjectives: ['Classic Round Knob', 'Duralock Lever Handle', 'Ultra Vertibolt', 'Premium Zinc Mortise Set', 'Universal Cylindrical Lockcase'],
    types: ['Mortise Door Handle Set', 'Double Action Rim Deadbolt', 'Bathroom Privacy Lever Lock', 'Office Entrance Lockcase Set', 'Keyed Alike Mortise Lock System'],
    desc: 'Trusted mechanical handle sets providing high resistance against force and picking.'
  },
  {
    categoryName: 'Padlocks',
    parentCategoryName: 'Locks & Security',
    brandName: 'Godrej',
    adjectives: ['Nav-Tal 7 Levers', 'Duralock Hardened Steel', 'Sherlock Hardened Shackle', 'Round Padlock', 'Heavy Duty Brass Padlock'],
    types: ['Classic Brass Padlock', 'Weather-Resistant Outdoor Lock', 'Armor-Clad Anti-Cut Padlock', 'Keyed Alike Padlock Set', 'High Security Disc Lock'],
    desc: 'The iconic heavy-duty brass padlock designed for ultimate security of main gates and shutters.'
  }
];

const FINISHES = ['Matt Black', 'Satin Brass', 'Antique Bronze', 'Polished Chrome'];
const SIZES = ['Standard', 'Pro Max', 'Elite Series'];

async function main() {
  console.log('🌱 Starting Product Seeding (100 products)...');
  try {
    // 0. Clean up existing database records to prevent FK constraint failures and start fresh
    console.log('Cleaning up existing database records (purging transaction and product tables)...');
    
    // Delete payment and payment allocations
    await db.delete(paymentAllocations);
    await db.delete(payments);
    
    // Delete GST records referencing invoices
    await db.delete(gstr1Data);
    await db.delete(gstr3bData);
    await db.delete(hsnSummary);
    await db.delete(gstReturnPeriods);
    
    // Delete invoice line items and parent invoices
    await db.delete(invoiceLineItems);
    await db.delete(invoiceAttachments);
    await db.delete(invoices);
    
    // Delete order line items and parent orders
    await db.delete(orderItems);
    await db.delete(orders);
    
    // Delete inventory entries
    await db.delete(inventoryTransactions);
    await db.delete(inventory);
    
    // Delete variants price history, variants, and products
    await db.delete(productVariantPriceHistory);
    await db.delete(productVariants);
    await db.delete(products);
    
    // Delete subcategories first, then parent categories to avoid parent_id self-referential violations
    await db.delete(categories).where(sql`parent_id IS NOT NULL`);
    await db.delete(categories);
    
    // Delete brands
    await db.delete(brands);
    
    console.log('✅ Clean-up complete. Database is now in a fresh state.');

    // 1. Resolve Master Records (UOM, HSN, Tax)
    const [uom] = await db.select().from(unitsOfMeasurement).where(eq(unitsOfMeasurement.code, 'PCS')).limit(1);
    const uomId = uom?.id || null;

    const [taxRate] = await db.select().from(taxRates).where(eq(taxRates.ratePercentage, '18.00')).limit(1);
    const taxRateId = taxRate?.id || null;

    const [hsn] = await db.select().from(hsnCodes).where(eq(hsnCodes.code, '8302')).limit(1);
    const hsnCodeId = hsn?.id || null;

    console.log(`Resolved Masters: UOM(${uom?.code}), Tax(${taxRate?.ratePercentage}%), HSN(${hsn?.code})`);

    // 1b. Resolve/Create default warehouse
    let warehouseId: string;
    const [existingWarehouse] = await db.select().from(warehouses).where(eq(warehouses.orgId, SEED_ORG_ID)).limit(1);
    
    if (existingWarehouse) {
      warehouseId = existingWarehouse.id;
      console.log(`Resolved Warehouse: ${existingWarehouse.name} (${warehouseId})`);
    } else {
      const [newWarehouse] = await db.insert(warehouses).values({
        orgId: SEED_ORG_ID,
        name: 'Main Warehouse',
        code: 'MWH-01',
        isDefault: true,
        isActive: true,
        addressLine1: '101 Industrial Area',
        city: 'Mumbai',
        stateCode: '27',
        stateName: 'Maharashtra',
        pincode: '400051',
        country: 'India'
      }).returning();
      warehouseId = newWarehouse.id;
      console.log(`Created Default Warehouse: ${newWarehouse.name} (${warehouseId})`);
    }

    // 2. Seed Brands
    const brandMap = new Map<string, string>();
    for (const bTemplate of BRANDS_TO_SEED) {
      const slug = slugify(bTemplate.name);
      const [existing] = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
      if (existing) {
        brandMap.set(bTemplate.name, existing.id);
      } else {
        const [inserted] = await db
          .insert(brands)
          .values({
            orgId: SEED_ORG_ID,
            name: bTemplate.name,
            slug,
            isActive: true
          })
          .returning();
        brandMap.set(bTemplate.name, inserted.id);
        console.log(`Created Brand: ${bTemplate.name}`);
      }
    }

    // 3. Seed Categories
    const categoryMap = new Map<string, string>();
    // Seed parents first
    for (const catTemplate of CATEGORIES_TO_SEED.filter(c => c.parentName === null)) {
      const slug = slugify(catTemplate.name);
      const [existing] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
      if (existing) {
        categoryMap.set(catTemplate.name, existing.id);
      } else {
        const [inserted] = await db
          .insert(categories)
          .values({
            orgId: SEED_ORG_ID,
            name: catTemplate.name,
            slug,
            isActive: true
          })
          .returning();
        categoryMap.set(catTemplate.name, inserted.id);
        console.log(`Created Parent Category: ${catTemplate.name}`);
      }
    }
    // Seed children next
    for (const catTemplate of CATEGORIES_TO_SEED.filter(c => c.parentName !== null)) {
      const slug = slugify(catTemplate.name);
      const [existing] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
      if (existing) {
        categoryMap.set(catTemplate.name, existing.id);
      } else {
        const parentId = categoryMap.get(catTemplate.parentName!);
        const [inserted] = await db
          .insert(categories)
          .values({
            orgId: SEED_ORG_ID,
            name: catTemplate.name,
            slug,
            parentId: parentId || null,
            isActive: true
          })
          .returning();
        categoryMap.set(catTemplate.name, inserted.id);
        console.log(`Created Subcategory: ${catTemplate.name} -> Parent: ${catTemplate.parentName}`);
      }
    }

    // 4. Generate & Insert 102 Products (6 cycles of 17 templates)
    let totalInserted = 0;
    const seriesList = ['V100', 'V200', 'V300', 'V400', 'V500', 'V600'];

    for (let cIdx = 0; cIdx < seriesList.length; cIdx++) {
      const series = seriesList[cIdx];
      for (const t of PRODUCT_TEMPLATES) {
        const adj = t.adjectives[cIdx % t.adjectives.length];
        const type = t.types[cIdx % t.types.length];
        const prodName = `${adj} ${type} - ${series}`;
        const slug = slugify(prodName) + '-' + Math.random().toString(36).substring(2, 5);

        const categoryId = categoryMap.get(t.categoryName) || null;
        const brandId = brandMap.get(t.brandName) || null;

        await db.transaction(async (tx) => {
          // A. Insert Product
          const [product] = await tx
            .insert(products)
            .values({
              orgId: SEED_ORG_ID,
              name: prodName,
              slug,
              categoryId,
              brandId,
              taxRateId,
              hsnCodeId,
              description: `${t.desc} Heavy-duty construction, rated for high frequency utilization. Serial series ${series}.`,
              shortDescription: `Premium ${t.categoryName} from ${t.brandName}.`,
              type: 'goods',
              uomId,
              hasVariants: true,
              isTaxable: true,
              trackInventory: true,
              status: 'active',
              createdBy: SEED_USER_ID
            })
            .returning();

          // B. Generate 3 Variants per product
          for (let vIdx = 0; vIdx < 3; vIdx++) {
            const finish = FINISHES[vIdx % FINISHES.length];
            const size = SIZES[cIdx % SIZES.length];
            const attrs = { Finish: finish, Size: size };
            const varName = `${prodName} (${finish} / ${size})`;
            const variantSku = generateVariantSku(prodName, attrs);

            // Varied pricing
            const cost = 200 + (cIdx * 50) + (vIdx * 120);
            const margin = 20 + (vIdx * 5); // 20%, 25%, 30% margin
            const selling = Math.round(cost * (1 + margin / 100));
            const mrp = Math.round(selling * 1.3); // mrp is ~30% above selling price

            const [variant] = await tx
              .insert(productVariants)
              .values({
                orgId: SEED_ORG_ID,
                productId: product.id,
                sku: variantSku,
                name: varName,
                attributes: attrs,
                valuationCost: cost.toFixed(2),
mrp: mrp.toFixed(2),
                stockQuantity: 100 + (vIdx * 50),
                lowStockThreshold: 15,
                isActive: true,
                sortOrder: vIdx
              })
              .returning();

            // C. Insert Price History
            await tx
              .insert(productVariantPriceHistory)
              .values({
                orgId: SEED_ORG_ID,
                variantId: variant.id,
                valuationCost: variant.valuationCost || '0',
                mrp: variant.mrp,
                createdBy: SEED_USER_ID
              });

            // D. Insert Inventory record to link stock levels to the warehouse
            await tx
              .insert(inventory)
              .values({
                orgId: SEED_ORG_ID,
                warehouseId,
                productId: product.id,
                variantId: variant.id,
                quantityOnHand: variant.stockQuantity,
                quantityReserved: 0,
                reorderLevel: 10,
                reorderQuantity: 50
              });
          }
        });

        totalInserted++;
        if (totalInserted % 10 === 0) {
          console.log(`Inserted ${totalInserted} products...`);
        }
      }
    }

    console.log(`🎉 Successfully seeded ${totalInserted} products with 3 variants each!`);

  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await closeDatabase();
  }
}

main();
