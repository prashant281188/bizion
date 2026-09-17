'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import api from '@/lib/api';
import { API_ROUTES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { DataTable, type TableHeader } from '@/components/ui/data-table';
import { TableRow, TableCell } from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';
import { SearchFilterBar } from '@/components/ui/search-filter-bar';
import { ManageAccessModal } from '@/components/contacts/manage-access-modal';
import { KeyRound, ShieldCheck, ShieldAlert, Users, Phone, Mail, Building } from 'lucide-react';

export default function PortalUsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAccess, setFilterAccess] = useState<'all' | 'granted' | 'none'>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [accessContact, setAccessContact] = useState<{ id: string, name: string } | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get(API_ROUTES.CONTACTS.BASE, {
        params: { type: 'customer', q: search, limit: 200 }
      });
      setContacts(res.data.data || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchCustomers(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const roleHierarchy: Record<string, number> = { viewer: 0, customer: 0, agent: 1, accountant: 2, manager: 3, admin: 4, owner: 5 };
  const currentUserRoleLevel = currentUser?.role ? roleHierarchy[currentUser.role] || 0 : 0;
  const canManageAccess = currentUserRoleLevel >= 3 || hasPermission('users:update') || hasPermission('roles:manage');

  const filteredContacts = contacts.filter((c) => {
    if (filterAccess === 'granted') return !!c.hasPortalAccess;
    if (filterAccess === 'none') return !c.hasPortalAccess;
    return true;
  });

  const totalGranted = contacts.filter((c) => !!c.hasPortalAccess).length;
  const totalNoAccess = contacts.length - totalGranted;

  const tableHeaders: TableHeader[] = [
    { key: 'customer', label: 'Customer / Business' },
    { key: 'contact', label: 'Login Identifiers' },
    { key: 'status', label: 'Portal Access' },
    ...(canManageAccess ? [{ key: 'actions', label: 'Manage Access', align: 'right' as const }] : []),
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageHeader 
        title="Customer Portal Accounts" 
        subtitle="Manage B2B customer logins, reset customer passwords, and grant self-service portal access."
      />

      {errorMsg && <Alert variant="destructive">{errorMsg}</Alert>}

      {/* Filter & Metric Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setFilterAccess('all')}
          className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
            filterAccess === 'all'
              ? 'bg-amber-500/10 border-amber-400/80 shadow-2xs font-bold text-amber-950'
              : 'bg-white border-zinc-200/80 hover:bg-zinc-50 text-zinc-700 font-medium'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-amber-600" />
            <span className="text-xs">All Customers</span>
          </div>
          <span className="text-xs font-mono bg-zinc-100 px-2 py-0.5 rounded-full">{contacts.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterAccess('granted')}
          className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
            filterAccess === 'granted'
              ? 'bg-emerald-50 border-emerald-400/80 shadow-2xs font-bold text-emerald-950'
              : 'bg-white border-zinc-200/80 hover:bg-zinc-50 text-zinc-700 font-medium'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs">Access Enabled</span>
          </div>
          <span className="text-xs font-mono bg-emerald-100/80 text-emerald-800 px-2 py-0.5 rounded-full">{totalGranted}</span>
        </button>

        <button
          type="button"
          onClick={() => setFilterAccess('none')}
          className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
            filterAccess === 'none'
              ? 'bg-zinc-100 border-zinc-400/80 shadow-2xs font-bold text-zinc-950'
              : 'bg-white border-zinc-200/80 hover:bg-zinc-50 text-zinc-700 font-medium'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-zinc-500" />
            <span className="text-xs">No Access</span>
          </div>
          <span className="text-xs font-mono bg-zinc-200/80 text-zinc-700 px-2 py-0.5 rounded-full">{totalNoAccess}</span>
        </button>
      </div>

      <SearchFilterBar>
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            placeholder="Search by customer name, company, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-white"
          />
        </div>
      </SearchFilterBar>

      <DataTable
        headers={tableHeaders}
        isLoading={loading}
        isEmpty={filteredContacts.length === 0}
        emptyMessage="No customers found matching your filter."
      >
        {filteredContacts.map((contact) => (
          <TableRow key={contact.id} className="hover:bg-zinc-50/80 transition-colors">
            <TableCell className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-800 font-bold uppercase text-sm flex-shrink-0 border border-amber-200/50">
                  {contact.displayName?.[0] || 'C'}
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 text-sm">{contact.displayName}</div>
                  <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                    <Building className="w-3 h-3 text-zinc-400" />
                    <span>{contact.companyName || 'Individual Contact'}</span>
                  </div>
                </div>
              </div>
            </TableCell>

            <TableCell className="px-6 py-4">
              <div className="space-y-1">
                {contact.email ? (
                  <div className="text-xs text-zinc-800 flex items-center gap-1.5 font-medium">
                    <Mail className="w-3 h-3 text-zinc-400" />
                    <span>{contact.email}</span>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-400 italic">No email</span>
                )}
                {contact.phone || contact.mobile ? (
                  <div className="text-xs text-zinc-600 flex items-center gap-1.5 font-mono">
                    <Phone className="w-3 h-3 text-zinc-400" />
                    <span>{contact.phone || contact.mobile}</span>
                  </div>
                ) : null}
              </div>
            </TableCell>

            <TableCell className="px-6 py-4">
              {contact.hasPortalAccess ? (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border bg-emerald-50 text-emerald-800 border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Access Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border bg-zinc-100 text-zinc-600 border-zinc-200">
                  <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
                  Not Enabled
                </span>
              )}
            </TableCell>

            {canManageAccess && (
              <TableCell className="px-6 py-4 text-right">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setAccessContact({ id: contact.id, name: contact.displayName })}
                  className={`h-8 text-xs font-semibold rounded-xl transition-all ${
                    contact.hasPortalAccess
                      ? 'border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                      : 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  {contact.hasPortalAccess ? 'Manage Access' : 'Grant Access'}
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </DataTable>

      <ManageAccessModal
        open={!!accessContact}
        onOpenChange={(open) => {
          if (!open) {
            setAccessContact(null);
            fetchCustomers();
          }
        }}
        contactId={accessContact?.id || null}
        contactName={accessContact?.name || ''}
      />
    </div>
  );
}
