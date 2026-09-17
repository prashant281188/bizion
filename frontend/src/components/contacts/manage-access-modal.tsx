import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface ManageAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  contactName: string;
}

export function ManageAccessModal({ open, onOpenChange, contactId, contactName }: ManageAccessModalProps) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  
  // Fetch current access status
  const { data: accessData, isLoading, refetch } = useQuery({
    queryKey: ['contact', contactId, 'access'],
    queryFn: async () => {
      if (!contactId) return null;
      const res = await api.get(`/contacts/${contactId}/access`);
      return res.data.data;
    },
    enabled: !!contactId && open,
  });

  const manageAccess = useMutation({
    mutationFn: async ({ action, password }: { action: string; password?: string }) => {
      const res = await api.post(`/contacts/${contactId}/access`, { action, password });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Access updated successfully');
      setPassword('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update access');
    },
  });

  // Reset password state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setPassword('');
    }
  }, [open]);

  if (!contactId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-500" />
            Manage Portal Access
          </DialogTitle>
          <DialogDescription>
            Manage login credentials for <strong>{contactName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            {accessData?.hasAccess ? (
              <div className="space-y-6">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-900">Portal Access Enabled</h4>
                    <p className="text-xs text-emerald-700 mt-1">This customer can currently log in using:</p>
                    <ul className="text-xs font-medium text-emerald-800 mt-2 space-y-1 list-disc list-inside">
                      {accessData.email && <li>Email: {accessData.email}</li>}
                      {accessData.phone && <li>Mobile: {accessData.phone}</li>}
                    </ul>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-zinc-700">Change Password</label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="New password (min 6 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button 
                      variant="outline"
                      disabled={password.length < 6 || manageAccess.isPending}
                      onClick={() => manageAccess.mutate({ action: 'update_password', password })}
                    >
                      Update
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
                  <div className="text-sm">
                    <p className="font-semibold text-zinc-900">Revoke Access</p>
                    <p className="text-xs text-zinc-500">Prevent this customer from logging in.</p>
                  </div>
                  <Button 
                    variant="destructive"
                    size="sm"
                    disabled={manageAccess.isPending}
                    onClick={() => setShowRevokeConfirm(true)}
                  >
                    Revoke Access
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-amber-900">No Portal Access</h4>
                    <p className="text-xs text-amber-700 mt-1">
                      This customer cannot currently log into the portal. Enable access to allow them to view orders, invoices, and ledger.
                    </p>
                    {(!accessData?.email && !accessData?.phone) && (
                      <p className="text-xs text-red-600 font-semibold mt-2">
                        Wait! This contact must have an email or mobile number saved before you can enable access. Please edit the contact details first.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-zinc-700 block mb-1">Set Initial Password</label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Enter a secure password to share with the customer"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-zinc-500">
                    They will log in using their email or mobile number (if saved) and this password.
                  </p>
                </div>

                <Button 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={password.length < 6 || manageAccess.isPending || (!accessData?.email && !accessData?.phone)}
                  onClick={() => manageAccess.mutate({ action: 'enable', password })}
                >
                  Enable Portal Access
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
      <ConfirmDialog
        isOpen={showRevokeConfirm}
        onClose={() => setShowRevokeConfirm(false)}
        onConfirm={() => {
          manageAccess.mutate({ action: 'disable' });
          setShowRevokeConfirm(false);
        }}
        title="Revoke Portal Access"
        description="Are you sure you want to revoke portal access for this customer?"
        variant="destructive"
      />
    </Dialog>
  );
}
