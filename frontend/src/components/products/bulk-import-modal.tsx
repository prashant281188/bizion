'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, UploadCloud, AlertCircle, CheckCircle2, DownloadCloud, Settings } from 'lucide-react';
import ExcelJS from 'exceljs';
import * as xlsx from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface BulkImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  _originalIndex: number;
  _isValid: boolean;
  _errors: string[];
  
  name: string;
  variantName?: string;
  categoryId?: string;
  brandId?: string;
  taxRateId?: string;
  hsnCodeId?: string;
  uomId?: string;
  rawCategory?: string;
  rawBrand?: string;
  rawHsn?: string;
  
  sku?: string;
  barcode?: string;
  trackInventory: boolean;
  lowStockThreshold: number;
  
  purchaseMode: 'direct' | 'list';
  costPrice: number;
  listPrice: number;
  discountPct: number;
  marginPct: number;
  
  mrp: number;
  sellingPrice: number;
  basePrice: number;
  
  boxQuantity: number;
  defaultPacking?: string;
  description?: string;
  
  attributes: Record<string, string>;
  
  _raw: any;
}

export function BulkImportModal({ onClose, onSuccess }: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [dynamicAttributes, setDynamicAttributes] = useState<string>(''); // comma separated
  
  // Masters Data
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [hsnCodes, setHsnCodes] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [existingProducts, setExistingProducts] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/masters/categories?limit=500'),
      api.get('/masters/brands?limit=500'),
      api.get('/masters/tax-rates?limit=500'),
      api.get('/masters/hsn-codes?limit=500'),
      api.get('/masters/units?limit=500'),
      api.get('/products?limit=10000&flattenVariants=true')
    ]).then(([catRes, brandRes, taxRes, hsnRes, uomRes, prodRes]) => {
      setCategories(catRes.data.data || []);
      setBrands(brandRes.data.data || []);
      setTaxRates(taxRes.data.data || []);
      setHsnCodes(hsnRes.data.data || []);
      setUoms(uomRes.data.data || []);
      setExistingProducts(prodRes.data.data || []);
    }).catch(err => console.error('Failed to load masters', err));
  }, []);

  const existingAttributes = useMemo(() => {
    const keys = new Set<string>();
    existingProducts.forEach(p => {
      // The product list is fetched with flattenVariants=true, meaning attributes might be in rawProduct or rawVariant
      const prodAttrs = p.attributes || p.rawProduct?.attributes;
      const varAttrs = p.rawVariant?.attributes;
      
      if (prodAttrs) Object.keys(prodAttrs).forEach(k => keys.add(k));
      if (varAttrs) Object.keys(varAttrs).forEach(k => keys.add(k));
    });
    return Array.from(keys).sort();
  }, [existingProducts]);

  const toggleAttribute = (attr: string) => {
    const current = dynamicAttributes.split(',').map(a => a.trim()).filter(Boolean);
    if (current.includes(attr)) {
      setDynamicAttributes(current.filter(a => a !== attr).join(', '));
    } else {
      setDynamicAttributes([...current, attr].join(', '));
    }
  };

  const generateTemplate = async () => {
    setLoading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      
      const attrs = dynamicAttributes.split(',').map(a => a.trim()).filter(a => a);
      
      // Sheet 2: Masters Data
      const masterSheet = workbook.addWorksheet('MastersData', { state: 'hidden' });
      
      const catNames = categories.map(c => c.name);
      const brandNames = brands.map(b => b.name);
      const taxNames = taxRates.map(t => t.name);
      const hsnCodesList = hsnCodes.map(h => h.code);
      const uomCodes = uoms.map(u => u.code);
      
      const maxRows = Math.max(catNames.length, brandNames.length, taxNames.length, hsnCodesList.length, uomCodes.length, 2);
      
      masterSheet.getCell('A1').value = 'Categories';
      masterSheet.getCell('B1').value = 'Brands';
      masterSheet.getCell('C1').value = 'TaxRates';
      masterSheet.getCell('D1').value = 'HSNCodes';
      masterSheet.getCell('E1').value = 'UoMs';
      masterSheet.getCell('F1').value = 'PurchaseModes';
      masterSheet.getCell('G1').value = 'YesNo';

      for (let i = 0; i < maxRows; i++) {
        masterSheet.getCell(`A${i + 2}`).value = catNames[i] || '';
        masterSheet.getCell(`B${i + 2}`).value = brandNames[i] || '';
        masterSheet.getCell(`C${i + 2}`).value = taxNames[i] || '';
        masterSheet.getCell(`D${i + 2}`).value = hsnCodesList[i] || '';
        masterSheet.getCell(`E${i + 2}`).value = uomCodes[i] || '';
        if (i === 0) masterSheet.getCell('F2').value = 'Direct';
        if (i === 1) masterSheet.getCell('F3').value = 'List';
        if (i === 0) masterSheet.getCell('G2').value = 'Yes';
        if (i === 1) masterSheet.getCell('G3').value = 'No';
      }

      // Generate Defined Names for Validation
      if (catNames.length) workbook.definedNames.add(`MastersData!$A$2:$A$${catNames.length + 1}`, 'CatList');
      if (brandNames.length) workbook.definedNames.add(`MastersData!$B$2:$B$${brandNames.length + 1}`, 'BrandList');
      if (taxNames.length) workbook.definedNames.add(`MastersData!$C$2:$C$${taxNames.length + 1}`, 'TaxList');
      if (hsnCodesList.length) workbook.definedNames.add(`MastersData!$D$2:$D$${hsnCodesList.length + 1}`, 'HsnList');
      if (uomCodes.length) workbook.definedNames.add(`MastersData!$E$2:$E$${uomCodes.length + 1}`, 'UomList');
      workbook.definedNames.add(`MastersData!$F$2:$F$3`, 'ModeList');
      workbook.definedNames.add(`MastersData!$G$2:$G$3`, 'YesNoList');

      // Sheet 1: Template
      const sheet = workbook.addWorksheet('Template');
      
      const columns: any[] = [
        { header: 'Product Name*', key: 'name', width: 25 },
        { header: 'Variant Name', key: 'vname', width: 20 },
      ];

      attrs.forEach(attr => {
        columns.push({ header: `Attr: ${attr}`, key: `attr_${attr}`, width: 15 });
      });

      columns.push(
        { header: 'Category*', key: 'cat', width: 20 },
        { header: 'Brand', key: 'brand', width: 20 },
        { header: 'Purchase Mode', key: 'pmode', width: 15 },
        { header: 'Direct Cost', key: 'dcost', width: 12 },
        { header: 'List Price', key: 'list', width: 12 },
        { header: 'Disc %', key: 'disc', width: 10 },
        { header: 'Calc Cost', key: 'ccost', width: 12 },
        { header: 'Margin %', key: 'margin', width: 10 },
        { header: 'Selling Price*', key: 'sp', width: 15 },
        { header: 'MRP*', key: 'mrp', width: 12 },
        { header: 'Tax Rate', key: 'tax', width: 15 },
        { header: 'HSN', key: 'hsn', width: 12 },
        { header: 'UoM', key: 'uom', width: 10 },
        { header: 'Box Qty', key: 'bqty', width: 10 },
        { header: 'Track Inv', key: 'tinv', width: 10 },
        { header: 'Low Stock', key: 'lstock', width: 10 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'Barcode', key: 'barcode', width: 15 }
      );

      sheet.columns = columns;

      // Helper to get column letter by key
      const col = (key: string) => sheet.getColumn(key).letter;

      // Add one empty row with formulas
      sheet.addRow({});

      // Apply validations and formulas to first 100 rows
      for (let i = 2; i <= 101; i++) {
        // Variant Name formula
        if (attrs.length > 0) {
          const startCol = col(`attr_${attrs[0]}`);
          const endCol = col(`attr_${attrs[attrs.length - 1]}`);
          sheet.getCell(`${col('vname')}${i}`).value = { formula: `IF(ISBLANK(${col('name')}${i}), "", TEXTJOIN(" - ", TRUE, ${col('name')}${i}, ${startCol}${i}:${endCol}${i}))`, date1904: false };
        }

        if (catNames.length) sheet.getCell(`${col('cat')}${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['CatList'] };
        if (brandNames.length) sheet.getCell(`${col('brand')}${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['BrandList'] };
        sheet.getCell(`${col('pmode')}${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['ModeList'] };
        
        // Calculated Cost Formula: IF(PMode="List", List * (1 - Disc/100), DirectCost)
        sheet.getCell(`${col('ccost')}${i}`).value = { formula: `IF(${col('pmode')}${i}="List", ${col('list')}${i}*(1-${col('disc')}${i}/100), ${col('dcost')}${i})`, date1904: false };
        
        // Selling Price Formula: CalcCost * (1 + Margin/100) -> Rounded to 0.5: ROUND(value * 2, 0) / 2
        sheet.getCell(`${col('sp')}${i}`).value = { formula: `ROUND(${col('ccost')}${i}*(1+${col('margin')}${i}/100)*2, 0)/2`, date1904: false };

        if (taxNames.length) sheet.getCell(`${col('tax')}${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['TaxList'] };
        if (hsnCodesList.length) sheet.getCell(`${col('hsn')}${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['HsnList'] };
        if (uomCodes.length) sheet.getCell(`${col('uom')}${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['UomList'] };
        
        sheet.getCell(`${col('tinv')}${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['YesNoList'] };
      }

      sheet.getRow(1).font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product_import_template.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      
      setShowConfig(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate template');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const findMasterId = (list: any[], value: string, field: string = 'name') => {
    if (!value) return undefined;
    const match = list.find(item => String(item[field]).toLowerCase() === String(value).trim().toLowerCase());
    return match?.id;
  };

  const processFile = async () => {
    if (!file) return;
    setLoading(true);

    try {
      // Use xlsx to read the file to easily extract calculated formula values
      const buffer = await file.arrayBuffer();
      const workbook = xlsx.read(buffer, { type: 'array' });
      
      const worksheet = workbook.Sheets['Template'] || workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json<any>(worksheet, { defval: '' });

      const parsedRowsData: ParsedRow[] = [];
      const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase()));
      const existingSkus = new Set(existingProducts.map(p => p.sku?.toLowerCase()).filter(Boolean));
      const fileSkus = new Set();

      data.forEach((row, index) => {
        // Skip completely empty rows
        if (!row['Product Name*']) return;

        const errors: string[] = [];
        
        const rawName = String(row['Product Name*']).trim();
        if (!rawName) errors.push("Product Name is required");
        else if (existingNames.has(rawName.toLowerCase())) {
          errors.push(`Product '${rawName}' already exists in database`);
        }

        const rawSp = Number(row['Selling Price*']);
        if (isNaN(rawSp)) errors.push("Selling Price must be a number");
        
        const rawMrp = Number(row['MRP*']);
        if (isNaN(rawMrp)) errors.push("MRP must be a number");

        const rawDirectCost = Number(row['Direct Cost'] || 0);
        const rawListPrice = Number(row['List Price'] || 0);
        const rawDisc = Number(row['Disc %'] || 0);
        const rawMargin = Number(row['Margin %'] || 0);
        const rawCalcCost = Number(row['Calc Cost'] || rawDirectCost);

        const pModeStr = String(row['Purchase Mode'] || '').toLowerCase();
        const purchaseMode = pModeStr === 'list' ? 'list' : 'direct';

        const trackInvStr = String(row['Track Inv'] || '').toLowerCase();
        const trackInventory = trackInvStr === 'yes' || trackInvStr === 'y';

        let boxQty = parseInt(row['Box Qty'] || '1', 10);
        if (isNaN(boxQty) || boxQty < 1) boxQty = 1;

        let lowStock = parseInt(row['Low Stock'] || '10', 10);
        if (isNaN(lowStock)) lowStock = 10;

        const rawCat = row['Category*'] ? String(row['Category*']).trim() : '';
        const rawBrand = row['Brand'] ? String(row['Brand']).trim() : '';
        const rawHsn = row['HSN'] ? String(row['HSN']).trim() : '';

        // Mapping
        const catId = findMasterId(categories, rawCat);
        const brandId = findMasterId(brands, rawBrand);
        const taxId = findMasterId(taxRates, row['Tax Rate']);
        const hsnId = findMasterId(hsnCodes, rawHsn, 'code');
        const uomId = findMasterId(uoms, row['UoM'], 'code') || findMasterId(uoms, row['UoM'], 'name');

        if (!rawCat) errors.push(`Category is required`);
        if (row['Tax Rate'] && !taxId) errors.push(`Tax Rate '${row['Tax Rate']}' not found`);

        // Extract Attributes dynamically
        const attributes: Record<string, string> = {};
        Object.keys(row).forEach(key => {
          if (key.startsWith('Attr: ')) {
            const attrName = key.replace('Attr: ', '').trim();
            if (row[key]) attributes[attrName] = String(row[key]);
          }
        });
        
        const rawSku = row['SKU'] ? String(row['SKU']).trim() : undefined;
        if (rawSku) {
          if (existingSkus.has(rawSku.toLowerCase())) {
            errors.push(`SKU '${rawSku}' already exists in database`);
          } else if (fileSkus.has(rawSku.toLowerCase())) {
            errors.push(`SKU '${rawSku}' is duplicated in this file`);
          } else {
            fileSkus.add(rawSku.toLowerCase());
          }
        }

        parsedRowsData.push({
          _originalIndex: index + 2,
          _isValid: errors.length === 0,
          _errors: errors,
          
          name: rawName,
          variantName: row['Variant Name'] ? String(row['Variant Name']).trim() : undefined,
          
          categoryId: catId,
          brandId: brandId,
          taxRateId: taxId,
          hsnCodeId: hsnId,
          uomId: uomId,
          rawCategory: rawCat,
          rawBrand: rawBrand,
          rawHsn: rawHsn,
          
          sku: rawSku,
          barcode: row['Barcode'] ? String(row['Barcode']).trim() : undefined,
          trackInventory,
          lowStockThreshold: lowStock,
          
          purchaseMode,
          costPrice: rawCalcCost,
          listPrice: rawListPrice,
          discountPct: rawDisc,
          marginPct: rawMargin,
          
          mrp: rawMrp,
          sellingPrice: rawSp,
          basePrice: rawSp, // Assuming basePrice matches sellingPrice without tax
          
          boxQuantity: boxQty,
          attributes,
          
          _raw: row
        });
      });

      setParsedRows(parsedRowsData);
    } catch (err: any) {
      toast.error(`Error parsing Excel file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveProducts = async () => {
    const validRows = parsedRows.filter(r => r._isValid);
    const invalidRows = parsedRows.filter(r => !r._isValid);
    
    if (validRows.length === 0) {
      toast.error('No valid products to import.');
      return;
    }

    try {
      setLoading(true);
      
      // 1. Auto-create missing masters
      const missingCategories = Array.from(new Set(validRows.filter(r => r.rawCategory && !r.categoryId).map(r => r.rawCategory as string)));
      for (const catName of missingCategories) {
        try {
          const res = await api.post('/masters/categories', { name: catName });
          const newId = res.data.data.id;
          validRows.forEach(r => { if (r.rawCategory === catName) r.categoryId = newId; });
        } catch (err) { console.error(`Failed to create category ${catName}`, err); }
      }

      const missingBrands = Array.from(new Set(validRows.filter(r => r.rawBrand && !r.brandId).map(r => r.rawBrand as string)));
      for (const brandName of missingBrands) {
        try {
          const res = await api.post('/masters/brands', { name: brandName });
          const newId = res.data.data.id;
          validRows.forEach(r => { if (r.rawBrand === brandName) r.brandId = newId; });
        } catch (err) { console.error(`Failed to create brand ${brandName}`, err); }
      }

      const missingHsns = Array.from(new Set(validRows.filter(r => r.rawHsn && !r.hsnCodeId).map(r => r.rawHsn as string)));
      for (const hsnCode of missingHsns) {
        try {
          const res = await api.post('/masters/hsn-codes', { code: hsnCode, description: hsnCode });
          const newId = res.data.data.id;
          validRows.forEach(r => { if (r.rawHsn === hsnCode) r.hsnCodeId = newId; });
        } catch (err) { console.error(`Failed to create HSN ${hsnCode}`, err); }
      }

      // Group variants by Product Name
      const productGroups = new Map<string, ParsedRow[]>();
      validRows.forEach(r => {
        const key = r.name.toLowerCase();
        if (!productGroups.has(key)) {
          productGroups.set(key, []);
        }
        productGroups.get(key)!.push(r);
      });

      const payload = [];

      for (const [_, groupRows] of productGroups.entries()) {
        const mainRow = groupRows[0];
        
        const productObj: any = {
          name: mainRow.name,
          sku: mainRow.sku,
          barcode: mainRow.barcode,
          categoryId: mainRow.categoryId || null,
          brandId: mainRow.brandId || null,
          taxRateId: mainRow.taxRateId || null,
          hsnCodeId: mainRow.hsnCodeId || null,
          uomId: mainRow.uomId || null,
          
          purchaseMode: mainRow.purchaseMode,
          listPrice: mainRow.listPrice,
          discountPct: mainRow.discountPct,
          marginPct: mainRow.marginPct,
          costPrice: mainRow.costPrice,
          mrp: mainRow.mrp,
          sellingPrice: mainRow.sellingPrice,
          basePrice: mainRow.basePrice,
          
          trackInventory: mainRow.trackInventory,
          boxQuantity: mainRow.boxQuantity,
          
          attributes: mainRow.attributes,
          status: 'active',
          
          hasVariants: groupRows.length > 1,
          variants: [],
        };

        if (groupRows.length > 1) {
          groupRows.forEach(variantRow => {
            productObj.variants.push({
              name: variantRow.variantName || variantRow.name,
              sku: variantRow.sku,
              barcode: variantRow.barcode,
              
              purchaseMode: variantRow.purchaseMode,
              listPrice: variantRow.listPrice,
              discountPct: variantRow.discountPct,
              marginPct: variantRow.marginPct,
              costPrice: variantRow.costPrice,
              mrp: variantRow.mrp,
              sellingPrice: variantRow.sellingPrice,
              basePrice: variantRow.basePrice,
              
              boxQuantity: variantRow.boxQuantity,
              lowStockThreshold: variantRow.lowStockThreshold,
              
              attributes: variantRow.attributes,
            });
          });
        }

        payload.push(productObj);
      }

      await api.post('/products/bulk', { products: payload });
      toast.success(`Successfully imported ${payload.length} valid product(s). ${invalidRows.length > 0 ? `Skipped ${invalidRows.length} invalid row(s).` : ''}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to import products');
    } finally {
      setLoading(false);
    }
  };

  const validCount = parsedRows.filter(r => r._isValid).length;
  const invalidCount = parsedRows.filter(r => !r._isValid).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex flex-col p-4">
      <div className="bg-white rounded-xl shadow-2xl flex-1 flex flex-col overflow-hidden max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center p-6 border-b border-zinc-200">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Advanced Excel Bulk Importer</h2>
            <p className="text-sm text-zinc-500">Download a smart Excel template with built-in formulas and dropdowns for fast data entry.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-500 hover:text-zinc-900">Close</Button>
        </div>

        <div className="p-6 flex-1 flex flex-col min-h-0 bg-zinc-50/50">
          <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg border border-zinc-200 shadow-sm mb-4">
            <Input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="max-w-sm h-10" />
            <Button onClick={processFile} disabled={!file || loading} className="bg-zinc-900 text-white hover:bg-zinc-800 h-10">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
              Parse Excel
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setShowConfig(true)} className="text-amber-700 border-amber-200 hover:bg-amber-50 h-10">
              <DownloadCloud className="w-4 h-4 mr-2" />
              Get Smart Template
            </Button>
          </div>

          {parsedRows.length > 0 && (
            <div className="flex-1 flex flex-col min-h-0 bg-white border border-zinc-200 rounded-lg shadow-sm">
              <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                <div className="flex gap-4 text-sm font-medium">
                  <span className="text-zinc-700">Total Rows: {parsedRows.length}</span>
                  <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Valid: {validCount}</span>
                  {invalidCount > 0 && <span className="text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4"/> Invalid: {invalidCount}</span>}
                </div>
                <Button onClick={saveProducts} disabled={loading || invalidCount > 0} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Import to Database
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader className="bg-zinc-100 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Variant Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Cost Price</TableHead>
                      <TableHead>Selling Price</TableHead>
                      <TableHead>Attributes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, i) => (
                      <TableRow key={i} className={!row._isValid ? "bg-red-50/50" : ""}>
                        <TableCell className="font-mono text-zinc-500">{row._originalIndex}</TableCell>
                        <TableCell>
                          {row._isValid ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">Valid</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase w-max">Error</span>
                              <span className="text-[10px] text-red-600 font-medium">{row._errors.join(', ')}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.variantName}</TableCell>
                        <TableCell>
                          {row._raw['Category*']}
                          {row._raw['Category*'] && !row.categoryId && <span className="ml-2 text-red-500 text-xs">(Unmapped)</span>}
                        </TableCell>
                        <TableCell>{row.costPrice?.toFixed(2)}</TableCell>
                        <TableCell className="text-amber-700 font-semibold">{row.sellingPrice?.toFixed(2)}</TableCell>
                        <TableCell>
                           {Object.keys(row.attributes).length > 0 && (
                             <span className="text-xs text-zinc-500">{JSON.stringify(row.attributes)}</span>
                           )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Template</DialogTitle>
            <DialogDescription>Add custom attributes (like Color, Size) as dedicated columns in your Excel file.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Variant Attributes (Comma Separated)</Label>
              <Input 
                value={dynamicAttributes}
                onChange={(e) => setDynamicAttributes(e.target.value)}
                placeholder="e.g. Color, Size, Material"
                className="h-10"
              />
              {existingAttributes.length > 0 && (
                <div className="pt-3">
                  <p className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Select Existing Attributes</p>
                  <div className="flex flex-wrap gap-2">
                    {existingAttributes.map(attr => {
                      const isSelected = dynamicAttributes.split(',').map(a => a.trim()).includes(attr);
                      return (
                        <button
                          key={attr}
                          type="button"
                          onClick={() => toggleAttribute(attr)}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                            isSelected 
                              ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold shadow-sm' 
                              : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300'
                          }`}
                        >
                          {attr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfig(false)} className="h-10">Cancel</Button>
            <Button onClick={generateTemplate} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white h-10 font-bold">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DownloadCloud className="w-4 h-4 mr-2" />}
              Download Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
