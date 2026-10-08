import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function inr(amount: number | string, options?: { showSign?: boolean }): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return '\u20B90';
  const sign = options?.showSign && n > 0 ? '+' : '';
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: abs < 100 ? 2 : 0,
  }).format(abs);
  return sign + (n < 0 ? '-' : '') + '\u20B9' + formatted;
}

export function inrWords(amount: number): string {
  if (amount === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function twoDigits(n: number): string {
    return n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }
  let result = '';
  let rem = amount;
  const crore = Math.floor(rem / 10000000); rem = rem % 10000000;
  const lakh = Math.floor(rem / 100000); rem = rem % 100000;
  const thousand = Math.floor(rem / 1000); rem = rem % 1000;
  const hundred = Math.floor(rem / 100);
  const rest = Math.floor(rem % 100);
  if (crore) result += twoDigits(crore) + ' Crore ';
  if (lakh) result += twoDigits(lakh) + ' Lakh ';
  if (thousand) result += twoDigits(thousand) + ' Thousand ';
  if (hundred) result += ones[hundred] + ' Hundred ';
  if (rest) result += (result ? 'and ' : '') + twoDigits(rest);
  return result.trim();
}

export function shortDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + 'd ago';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function fullDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

export function maskToken(t: string, n = 4): string {
  if (!t || t.length < n * 2) return t;
  return t.slice(0, n) + '\u2022\u2022\u2022\u2022' + t.slice(-n);
}
