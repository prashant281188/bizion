'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { INDIAN_STATES } from '@/lib/constants';
import api from '@/lib/api';
import { toast } from 'sonner';

interface BulkImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkImportModal({ onClose, onSuccess }: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedContacts, setParsedContacts] = useState<any[]>([]);
  const [existingContacts, setExistingContacts] = useState<any[]>([]);

  // Fetch existing contacts to check for duplicates
  useEffect(() => {
    api.get('/contacts', { params: { limit: 5000 } })
      .then(res => {
        if (res.data?.data) {
          setExistingContacts(res.data.data);
        }
      })
      .catch(err => console.error('Failed to fetch contacts for duplicate check', err));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const revalidateContacts = (contacts: any[]) => {
    const existingNames = new Set(existingContacts.map(c => c.displayName?.toLowerCase()).filter(Boolean));
    const existingEmails = new Set(existingContacts.map(c => c.email?.toLowerCase()).filter(Boolean));
    const existingGstins = new Set(existingContacts.map(c => c.gstin?.toLowerCase()).filter(Boolean));

    const csvNames = new Set();
    const csvEmails = new Set();
    const csvGstins = new Set();

    contacts.forEach(contact => {
      const rowErrors = [];
      
      if (!contact.displayName) {
        rowErrors.push('Display Name is required');
      } else {
        const nameLower = contact.displayName.toLowerCase();
        if (existingNames.has(nameLower)) rowErrors.push('Display Name already exists in database');
        if (csvNames.has(nameLower)) rowErrors.push('Duplicate Display Name in this file');
        csvNames.add(nameLower);
      }

      if (contact.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
          rowErrors.push('Invalid email format');
        } else {
          const emailLower = contact.email.toLowerCase();
          if (existingEmails.has(emailLower)) rowErrors.push('Email already exists in database');
          if (csvEmails.has(emailLower)) rowErrors.push('Duplicate Email in this file');
          csvEmails.add(emailLower);
        }
      }

      if (contact.gstin) {
        if (contact.gstin.length !== 15) {
          rowErrors.push('GSTIN must be 15 characters');
        } else {
          const gstinLower = contact.gstin.toLowerCase();
          if (existingGstins.has(gstinLower)) rowErrors.push('GSTIN already exists in database');
          if (csvGstins.has(gstinLower)) rowErrors.push('Duplicate GSTIN in this file');
          csvGstins.add(gstinLower);
        }
      }

      const addr = contact.addresses?.[0];
      const hasAnyAddressField = addr && (addr.addressLine1 || addr.city || addr.stateName || addr.stateCode || addr.pincode);

      if (hasAnyAddressField) {
        if (!addr.addressLine1) rowErrors.push('Address Line 1 is required');
        if (!addr.city) rowErrors.push('City is required');
        if (!addr.stateName) rowErrors.push('State Name is required');
        if (!addr.stateCode || addr.stateCode.length !== 2) rowErrors.push('State Code must be 2 characters');
        if (!addr.pincode || !/^[0-9]{6}$/.test(addr.pincode)) rowErrors.push('Pincode must be 6 digits');
      }

      contact._isValid = rowErrors.length === 0;
      contact._errors = rowErrors;
    });

    return [...contacts];
  };

  const updateContact = (index: number, field: string, value: string) => {
    const updated = [...parsedContacts];
    const contact = updated[index];

    if (field === 'type') {
      contact.type = value;
    } else if (field === 'stateName') {
      const stateObj = INDIAN_STATES.find(s => s.name === value);
      if (!contact.addresses || contact.addresses.length === 0) {
        contact.addresses = [{}];
      }
      contact.addresses[0].stateName = value;
      if (stateObj) {
        contact.addresses[0].stateCode = stateObj.code;
      } else {
        contact.addresses[0].stateCode = ''; // Clear if invalid
      }
    }

    setParsedContacts(revalidateContacts(updated));
  };

  const processCsv = async () => {
    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n').filter(row => row.trim().length > 0);
        
        if (rows.length < 2) {
          throw new Error('File must contain a header row and at least one data row.');
        }

        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        const contacts = [];

        const nameIdx = headers.findIndex(h => h.includes('display name') || (h.includes('name') && !h.includes('company') && !h.includes('contact')));
        const compIdx = headers.findIndex(h => h.includes('company'));
        const personIdx = headers.findIndex(h => h.includes('contact person'));
        const typeIdx = headers.findIndex(h => h.includes('type'));
        const emailIdx = headers.findIndex(h => h.includes('email'));
        const phoneIdx = headers.findIndex(h => h === 'phone');
        const mobileIdx = headers.findIndex(h => h === 'mobile');
        const websiteIdx = headers.findIndex(h => h.includes('website'));
        const panIdx = headers.findIndex(h => h.includes('pan'));
        const gstinIdx = headers.findIndex(h => h.includes('gstin'));
        const creditIdx = headers.findIndex(h => h.includes('credit limit'));
        const openingIdx = headers.findIndex(h => h.includes('opening balance'));
        const notesIdx = headers.findIndex(h => h.includes('notes'));
        
        // Address fields
        const addrLine1Idx = headers.findIndex(h => h.includes('address line 1'));
        const addrLine2Idx = headers.findIndex(h => h.includes('address line 2'));
        const cityIdx = headers.findIndex(h => h.includes('city'));
        const stateNameIdx = headers.findIndex(h => h.includes('state name'));
        const stateCodeIdx = headers.findIndex(h => h.includes('state code'));
        const pincodeIdx = headers.findIndex(h => h.includes('pincode') || h.includes('zip'));
        const countryIdx = headers.findIndex(h => h.includes('country'));

        if (nameIdx === -1) {
          throw new Error('CSV must contain a column for Display Name.');
        }

        for (let i = 1; i < rows.length; i++) {
          const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
          const cols = rows[i].split(regex).map(c => c.trim().replace(/^"|"$/g, ''));
          
          if (!cols[nameIdx]) continue; // Skip empty rows

          const contact: any = {
            displayName: cols[nameIdx],
            companyName: compIdx !== -1 && cols[compIdx] ? cols[compIdx] : null,
            contactPerson: personIdx !== -1 && cols[personIdx] ? cols[personIdx] : null,
            type: typeIdx !== -1 && ['customer', 'vendor', 'both'].includes(cols[typeIdx].toLowerCase()) 
                  ? cols[typeIdx].toLowerCase() : 'customer',
            email: emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx] : null,
            phone: phoneIdx !== -1 && cols[phoneIdx] ? cols[phoneIdx] : null,
            mobile: mobileIdx !== -1 && cols[mobileIdx] ? cols[mobileIdx] : null,
            website: websiteIdx !== -1 && cols[websiteIdx] ? cols[websiteIdx] : null,
            pan: panIdx !== -1 && cols[panIdx] ? cols[panIdx].toUpperCase() : null,
            gstin: gstinIdx !== -1 && cols[gstinIdx] ? cols[gstinIdx].toUpperCase() : null,
            gstRegistrationType: gstinIdx !== -1 && cols[gstinIdx] ? 'regular' : 'unregistered',
            creditLimit: creditIdx !== -1 && cols[creditIdx] ? Number(cols[creditIdx]) || 0 : 0,
            openingBalance: openingIdx !== -1 && cols[openingIdx] ? Number(cols[openingIdx]) || 0 : 0,
            notes: notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx] : null,
          };

          // Build Address
          const addressLine1 = addrLine1Idx !== -1 && cols[addrLine1Idx] ? cols[addrLine1Idx] : null;
          const city = cityIdx !== -1 && cols[cityIdx] ? cols[cityIdx] : null;
          const stateName = stateNameIdx !== -1 && cols[stateNameIdx] ? cols[stateNameIdx] : null;
          const stateCode = stateCodeIdx !== -1 && cols[stateCodeIdx] ? cols[stateCodeIdx].toUpperCase() : null;
          const pincode = pincodeIdx !== -1 && cols[pincodeIdx] ? cols[pincodeIdx] : null;

          const hasAnyAddressField = addressLine1 || city || stateName || stateCode || pincode;
          let addressObj = null;

          if (hasAnyAddressField) {
            addressObj = {
              label: 'Main',
              addressLine1,
              addressLine2: addrLine2Idx !== -1 && cols[addrLine2Idx] ? cols[addrLine2Idx] : null,
              city,
              stateName,
              stateCode,
              pincode,
              country: countryIdx !== -1 && cols[countryIdx] ? cols[countryIdx] : 'India',
              isBillingDefault: true,
              isShippingDefault: true
            };
            contact.addresses = [addressObj];
          }

          contacts.push(contact);
        }

        if (contacts.length === 0) {
          throw new Error('No valid data rows found in the file.');
        }

        setParsedContacts(revalidateContacts(contacts));
      } catch (err: any) {
        console.error('Parse failed:', err);
        setError(err.message || 'Failed to parse the CSV file.');
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Error reading the file.');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  const saveContacts = async () => {
    const validContacts = parsedContacts.filter(c => c._isValid).map((c) => {
      const { _isValid, _errors, ...rest } = c;
      return rest;
    });

    if (validContacts.length === 0) {
      toast.error('No valid contacts to import.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/contacts/bulk', { contacts: validContacts });
      toast.success(res.data?.message || `${validContacts.length} contacts imported successfully!`);
      onSuccess();
    } catch (err: any) {
      console.error('Save failed:', err);
      toast.error(err.response?.data?.error || 'Failed to save contacts.');
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = 'Display Name,Company Name,Contact Person,Type,Email,Phone,Mobile,Website,PAN,GSTIN,Credit Limit,Opening Balance,Notes,Address Line 1,Address Line 2,City,State Name,State Code,Pincode\n';
    const example = 'John Doe,Acme Corp,Jane Doe,customer,john@example.com,0112345678,9876543210,www.acme.com,ABCDE1234F,07ABCDE1234F1Z5,50000,0,"First bulk import",123 Main St,Suite 400,Mumbai,Maharashtra,MH,400001\n';
    const blob = new Blob([headers + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_import_template_full.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFile(null);
    setParsedContacts([]);
    setError(null);
    // Reset file input element if needed (handled implicitly by keying or React state)
  };

  const validCount = parsedContacts.filter(c => c._isValid).length;
  const invalidCount = parsedContacts.length - validCount;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold text-zinc-900">
            {parsedContacts.length > 0 ? 'Preview Import Data' : 'Bulk Import Contacts'}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto grow">
          {parsedContacts.length === 0 ? (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm">
                <p className="font-medium mb-1">Import Requirements:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>File must be in <strong>.csv</strong> format.</li>
                  <li>A column for <strong>Display Name</strong> is required.</li>
                  <li>Optional Profile Columns: Company Name, Contact Person, Type, Email, Phone, Mobile, Website, PAN, GSTIN, Credit Limit, Opening Balance, Notes.</li>
                  <li>Optional Address Columns: If providing an address, you must include <strong>Address Line 1, City, State Name, State Code (2-chars), Pincode (6-digits)</strong>.</li>
                </ul>
                <button 
                  onClick={downloadTemplate}
                  className="mt-3 text-amber-700 font-medium underline hover:text-amber-900"
                >
                  Download Complete CSV Template
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Upload CSV File</label>
                <Input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange}
                  className="cursor-pointer file:cursor-pointer"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-lg border border-red-200">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <div className="text-sm text-zinc-600">
                  Found <span className="font-bold text-zinc-900">{parsedContacts.length}</span> contacts. 
                  Ready to import: <span className="font-bold text-amber-600">{validCount}</span>. 
                  Invalid: <span className="font-bold text-red-600">{invalidCount}</span>.
                </div>
                <Button variant="outline" size="sm" onClick={resetForm}>Start Over</Button>
              </div>

              <div className="border border-zinc-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table className="min-w-full text-left text-sm text-zinc-600">
                    <TableHeader className="px-6 py-4 bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                      <TableRow className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                        <TableHead className="px-6 py-4">Status</TableHead>
                        <TableHead className="px-6 py-4 min-w-[120px]">Display Name</TableHead>
                        <TableHead className="px-6 py-4">Type</TableHead>
                        <TableHead className="px-6 py-4">GSTIN</TableHead>
                        <TableHead className="px-6 py-4">State Name</TableHead>
                        <TableHead className="px-6 py-4">State Code</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-zinc-100">
                      {parsedContacts.map((contact, idx) => (
                        <TableRow key={idx} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50">
                          <TableCell className="px-6 py-4">
                            {contact._isValid ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">Valid</Badge>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <Badge className="bg-red-100 text-red-800 border-red-200 w-fit">Invalid</Badge>
                                <span className="text-[10px] text-red-600">{contact._errors.join(', ')}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-6 py-4 font-medium text-zinc-900">{contact.displayName}</TableCell>
                          <TableCell className="px-6 py-4">
                            <Select 
                              className="bg-white text-sm"
                              value={contact.type}
                              onChange={(e) => updateContact(idx, 'type', e.target.value)}
                              options={[
                                { value: 'customer', label: 'Customer' },
                                { value: 'vendor', label: 'Vendor' },
                                { value: 'both', label: 'Both' }
                              ]}
                            />
                          </TableCell>
                          <TableCell className="px-6 py-4 text-zinc-600">{contact.gstin || '-'}</TableCell>
                          <TableCell className="px-6 py-4">
                            <Select 
                              className="bg-white text-sm min-w-[140px]"
                              value={contact.addresses?.[0]?.stateName || ''}
                              onChange={(e) => updateContact(idx, 'stateName', e.target.value)}
                              options={[
                                { value: '', label: 'Select State...' },
                                ...INDIAN_STATES.map(s => ({ value: s.name, label: s.name }))
                              ]}
                            />
                          </TableCell>
                          <TableCell className="px-6 py-4 text-zinc-600 text-center">
                            {contact.addresses?.[0]?.stateCode ? (
                              <Badge variant="outline" className="font-mono">{contact.addresses[0].stateCode}</Badge>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              {invalidCount > 0 && (
                <p className="text-xs text-amber-600 font-medium">
                  Note: Only the {validCount} valid contacts will be imported. The {invalidCount} invalid rows will be ignored.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          {parsedContacts.length === 0 ? (
            <Button onClick={processCsv} disabled={!file || loading} className="bg-amber-600 hover:bg-amber-700 text-white">
              {loading ? 'Parsing...' : 'Preview Data'}
            </Button>
          ) : (
            <Button onClick={saveContacts} disabled={validCount === 0 || loading} className="bg-amber-600 hover:bg-amber-700 text-white">
              {loading ? 'Saving...' : `Confirm & Save ${validCount} Contacts`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
