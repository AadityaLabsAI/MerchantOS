import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Receipt as ReceiptIcon, Download, MessageCircle, FileText, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, Badge, EmptyState, Skeleton, Button, Modal, Field, Input } from '@/lib/ui';
import { inr, shortDate, fullDateTime } from '@/lib/utils';
import { useI18n, t } from '@/lib/i18n';
import { downloadBillPdf, previewBillPdf } from '@/lib/pdf';
import { buildBillShare, shareToWhatsApp } from '@/lib/whatsapp';
import { toast } from '@/lib/toast';

type Bill = { id: string; customerId?: string; customerName?: string; total: number; status: string; createdAt: string; method?: string };

export function BillsPage() {
  const { locale } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: ['bills'], queryFn: () => api.get<Bill[]>('/api/bill?limit=100') });
  const [shop, setShop] = useState<any>(null);
  const [openBill, setOpenBill] = useState<Bill | null>(null);
  const [billForm, setBillForm] = useState({ customerName: '', total: '', method: 'CASH' });

  useEffect(() => { api('/api/shop/settings').then(setShop).catch(() => {}); }, []);

  function downloadPdf(b: Bill) {
    if (!shop) { toast.error('Loading shop info...'); return; }
    downloadBillPdf({
      id: b.id, shop, customer: { name: b.customerName || 'Walk-in' },
      items: [{ name: b.customerName || 'Bill items', qty: 1, price: b.total, total: b.total }],
      subtotal: b.total, total: b.total, paid: b.status === 'PAID' ? b.total : 0,
      due: b.status === 'PAID' ? 0 : b.total, method: b.method || 'CASH', createdAt: b.createdAt,
    });
    toast.success(t('toast.saved', locale));
  }

  function shareWa(b: Bill) {
    if (!shop) { toast.error('Loading shop info...'); return; }
    const { url, text } = buildBillShare({
      id: b.id, customerName: b.customerName || 'Walk-in',
      items: [{ name: 'Bill', qty: 1, price: b.total, total: b.total }],
      subtotal: b.total, total: b.total, paid: b.status === 'PAID' ? b.total : 0,
      due: b.status === 'PAID' ? 0 : b.total, method: b.method || 'CASH', createdAt: b.createdAt,
    }, shop, locale);
    shareToWhatsApp(url);
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  function previewPdf(b: Bill) {
    if (!shop) return;
    previewBillPdf({
      id: b.id, shop, customer: { name: b.customerName || 'Walk-in' },
      items: [{ name: b.customerName || 'Bill items', qty: 1, price: b.total, total: b.total }],
      subtotal: b.total, total: b.total, paid: b.status === 'PAID' ? b.total : 0,
      due: b.status === 'PAID' ? 0 : b.total, method: b.method || 'CASH', createdAt: b.createdAt,
    });
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('bills.title', locale)}</h1>
        <p className="text-sm text-gray-500 mt-0.5">PDF download, WhatsApp share</p>
      </div>

      {isLoading ? <Skeleton className="h-32" />
        : (data ?? []).length === 0 ? <EmptyState icon={<ReceiptIcon className="size-10" />} title="No bills yet" />
        : (
          <Card>
            <div className="divide-y divide-gray-100">
              {(data ?? []).map(b => (
                <div key={b.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                      <ReceiptIcon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{b.customerName || 'Walk-in'}</div>
                      <div className="text-xs text-gray-500">Bill #{b.id.slice(0, 8)} · {shortDate(b.createdAt)} · {b.method || 'CASH'}</div>
                    </div>
                    <div className="text-right">
                      <div className="amount font-bold text-gray-900">{inr(b.total)}</div>
                      <Badge tone={b.status === 'PAID' ? 'success' : 'warning'}>{b.status}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 ml-13">
                    <button onClick={() => downloadPdf(b)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
                      <Download className="size-3.5" /> PDF
                    </button>
                    <span className="text-gray-300">|</span>
                    <button onClick={() => previewPdf(b)} className="text-xs font-semibold text-gray-600 hover:text-gray-700 inline-flex items-center gap-1">
                      <FileText className="size-3.5" /> Preview
                    </button>
                    <span className="text-gray-300">|</span>
                    <button onClick={() => shareWa(b)} className="text-xs font-semibold text-success-600 hover:text-success-700 inline-flex items-center gap-1">
                      <MessageCircle className="size-3.5" /> WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
    </div>
  );
}
