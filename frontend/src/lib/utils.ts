import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string | Date | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatIndianDate(dateString: string | Date | undefined): string {
  return formatDate(dateString);
}

export function getInitials(name: string = ''): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatVariantName(productName: string, variantName?: string | null, variantSku?: string | null): string {
  const pName = (productName || '').trim();
  const vName = (variantName || variantSku || '').trim();

  if (!vName) return pName;
  if (!pName) return vName;

  if (vName.toLowerCase().startsWith(pName.toLowerCase())) {
    return vName;
  }

  if (vName.toLowerCase() === pName.toLowerCase()) {
    return pName;
  }

  return `${pName} - ${vName}`;
}

export function getVariantDetailOnly(productName: string, variantName?: string | null): string {
  const pName = (productName || '').trim();
  const vName = (variantName || '').trim();
  if (!vName) return '';
  if (pName && vName.toLowerCase().startsWith(`${pName.toLowerCase()} - `)) {
    return vName.slice(pName.length + 3).trim();
  }
  if (pName && vName.toLowerCase().startsWith(pName.toLowerCase())) {
    return vName.slice(pName.length).replace(/^[-\s]+/, '').trim();
  }
  return vName;
}

export function numberToWordsIndian(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 20) return a[n];
    const tens = b[Math.floor(n / 10)];
    const units = a[n % 10];
    return [tens, units].filter(Boolean).join(' ');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    const parts = [];
    if (hundred > 0) parts.push(`${a[hundred]} Hundred`);
    if (rest > 0) parts.push(convertTwoDigits(rest));
    return parts.join(' and ');
  }

  const rounded = Math.round(num * 100) / 100;
  const wholePart = Math.floor(rounded);
  const paise = Math.round((rounded - wholePart) * 100);

  const crore = Math.floor(wholePart / 10000000);
  const lakh = Math.floor((wholePart % 10000000) / 100000);
  const thousand = Math.floor((wholePart % 100000) / 1000);
  const remaining = wholePart % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${convertThreeDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${convertThreeDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${convertThreeDigits(thousand)} Thousand`);
  if (remaining > 0) parts.push(convertThreeDigits(remaining));

  const rupeesStr = parts.length > 0 ? parts.join(' ') + ' Rupees' : 'Zero Rupees';
  const paiseStr = paise > 0 ? ` and ${convertTwoDigits(paise)} Paise` : '';

  return `Indian ${rupeesStr}${paiseStr} Only`;
}
