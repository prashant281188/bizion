'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { RecordPaymentModal } from './record-payment-modal';
import { toast } from 'sonner';

export function GlobalRecordPaymentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-record-payment-modal', handleOpen);
    return () => {
      window.removeEventListener('open-record-payment-modal', handleOpen);
    };
  }, []);

  // Fetch contacts for payment recording
  const { data: contactsData } = useQuery({
    queryKey: ['global-payment-contacts'],
    queryFn: async () => {
      const res = await api.get('/contacts?limit=500');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  // Fetch bank accounts for payment recording
  const { data: accountsData } = useQuery({
    queryKey: ['global-payment-accounts'],
    queryFn: async () => {
      const res = await api.get('/payments/bank-accounts');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  const handleSuccess = () => {
    toast.success('Payment recorded successfully');
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    setIsOpen(false);
  };

  return (
    <RecordPaymentModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onSuccess={handleSuccess}
      contacts={contactsData || []}
      accounts={accountsData || []}
    />
  );
}
