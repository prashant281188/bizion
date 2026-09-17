'use client';

import { useParams } from 'next/navigation';
import { InvoiceForm } from '../../form-page';

export default function EditInvoicePage() {
  const params = useParams();
  return <InvoiceForm invoiceId={params.id as string} />;
}
