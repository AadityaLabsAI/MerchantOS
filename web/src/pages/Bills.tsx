import { useQuery } from '@tanstack/react-query';
import { Receipt as ReceiptIcon, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, Badge, EmptyState, Skeleton } from '@/lib/ui';
import { inr, shortDate } from '@/lib/utils';

type Bill = { id: string; customerId?: string; customerName?: string; total: number; status: string; createdAt: string };

export function BillsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['bills'], queryFn: () => api.get<Bill[]>('/api/bill?limit=100') });

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
        <p className="text-sm text-gray-500 mt-0.5">GST-compliant invoices, ready to share or print</p>
      </div>

      {isLoading ? <Skeleton className="h-32" />
        : (data ?? []).length === 0 ? <EmptyState icon={<ReceiptIcon className="size-10" />} title="No bills yet" hint="Bills created at the POS will appear here" />
        : (
          <Card>
            <div className="divide-y divide-gray-100">
              {(data ?? []).map(b => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                    <ReceiptIcon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{b.customerName || 'Walk-in customer'}</div>
                    <div className="text-xs text-gray-500">Bill #{b.id.slice(0, 8)} • {shortDate(b.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="amount font-bold text-gray-900">{inr(b.total)}</div>
                    <Badge tone={b.status === 'PAID' ? 'success' : 'warning'}>{b.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
    </div>
  );
}
