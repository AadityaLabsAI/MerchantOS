// WhatsApp sharing - #1 viral vector for Indian merchants
import { t, type Locale } from './i18n';
import { formatCurrency } from './i18n';

interface ShopInfo {
  name: string;
  ownerName?: string;
  phone?: string;
  upiId?: string;
  address?: string;
  gst?: string;
}

function shop(s: ShopInfo) {
  return {
    name: s.name || t('app.name'),
    owner: s.ownerName || '',
    phone: s.phone || '',
    upi: s.upiId || '',
    address: s.address || '',
    gst: s.gst || '',
  };
}

function waLink(phone: string | undefined, text: string): string {
  const params = new URLSearchParams({ text });
  if (phone) params.set('phone', phone.replace(/[^\d]/g, ''));
  return `https://wa.me/?${params.toString()}`;
}

export function buildPaymentReminder(
  customer: { name: string; phone?: string; balance: number; lastTxnAt?: string },
  shopInfo: ShopInfo,
  locale: Locale = 'hinglish'
): { url: string; text: string } {
  const s = shop(shopInfo);
  const text = [
    `*${t('wa.reminder_title', locale)} - ${s.name}*`,
    '',
    `${t('common.name', locale)}: ${customer.name}`,
    `${t('common.balance', locale)}: *${formatCurrency(customer.balance)}*`,
    customer.lastTxnAt ? `${t('common.date', locale)}: ${new Date(customer.lastTxnAt).toLocaleDateString('en-IN')}` : '',
    '',
    s.upi ? `${t('common.upi', locale)}: ${s.upi}` : '',
    '',
    s.phone ? `${t('common.phone', locale)}: ${s.phone}` : '',
    '',
    `_${t('wa.thanks', locale)}_`,
  ].filter(Boolean).join('\n');
  return { url: waLink(customer.phone, text), text };
}

export function buildStatement(
  customer: { name: string; phone?: string; balance: number },
  entries: Array<{ date: string; type: 'CREDIT' | 'PAYMENT'; amount: number; note?: string }>,
  shopInfo: ShopInfo,
  locale: Locale = 'hinglish'
): { url: string; text: string } {
  const s = shop(shopInfo);
  const lines = [
    `*${t('wa.statement_title', locale)} - ${s.name}*`,
    '',
    `${t('common.name', locale)}: ${customer.name}`,
    `${t('common.balance', locale)}: *${formatCurrency(customer.balance)}*`,
    '',
    '---',
  ];
  for (const e of entries.slice(-20)) {
    const sign = e.type === 'CREDIT' ? '+' : '-';
    const label = e.type === 'CREDIT' ? t('khata.udhar', locale) : t('khata.paasa', locale);
    lines.push(`${new Date(e.date).toLocaleDateString('en-IN')}  ${sign}${formatCurrency(e.amount)}  ${label}${e.note ? ' (' + e.note + ')' : ''}`);
  }
  lines.push('---', '', s.upi ? `${t('common.upi', locale)}: ${s.upi}` : '', '', `_${t('wa.thanks', locale)}_`);
  const text = lines.join('\n');
  return { url: waLink(customer.phone, text), text };
}

export function buildBillShare(
  bill: {
    id: string; customerName: string; customerPhone?: string;
    items: Array<{ name: string; qty: number; price: number; total: number }>;
    subtotal: number; discount?: number; total: number; paid: number; due: number;
    method: string; createdAt: string;
  },
  shopInfo: ShopInfo,
  locale: Locale = 'hinglish'
): { url: string; text: string } {
  const s = shop(shopInfo);
  const lines: string[] = [
    `*${t('wa.bill_title', locale)} #${bill.id} - ${s.name}*`,
    '',
    `${new Date(bill.createdAt).toLocaleDateString('en-IN')}`,
    `${t('bills.customer', locale)}: ${bill.customerName}`,
    '',
    '--- ' + t('bills.items', locale) + ' ---',
  ];
  for (const it of bill.items) {
    lines.push(`${it.name} x ${it.qty}  =  ${formatCurrency(it.total)}`);
  }
  lines.push(
    '',
    `${t('common.subtotal', locale)}: ${formatCurrency(bill.subtotal)}`,
    bill.discount ? `${t('pos.discount', locale)}: -${formatCurrency(bill.discount)}` : '',
    `*${t('common.total', locale)}: ${formatCurrency(bill.total)}*`,
    `Method: ${bill.method}`,
  );
  if (bill.paid > 0) lines.push(`${t('pos.amount_collected', locale)}: ${formatCurrency(bill.paid)}`);
  if (bill.due > 0) {
    lines.push(`*${t('pos.balance_due', locale)}: ${formatCurrency(bill.due)}*`);
    if (s.upi) lines.push('', `${t('common.upi', locale)}: ${s.upi}`);
  }
  lines.push('', s.phone ? `${t('common.phone', locale)}: ${s.phone}` : '', `_${t('wa.thanks', locale)}_`);
  const text = lines.filter(Boolean).join('\n');
  return { url: waLink(bill.customerPhone, text), text };
}

export async function shareToWhatsApp(url: string): Promise<void> {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
