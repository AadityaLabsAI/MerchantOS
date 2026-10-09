import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, ArrowDownRight, ArrowUpRight, RefreshCcw, Receipt as ReceiptIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, Input, Badge, Tabs, EmptyState, Avatar, Skeleton } from '@/lib/ui';
import { inr, shortDate, cn } from '@/lib/utils';

type Txn = {
  id: string;
  type: 'PAYMENT' | 'BILL' | 'REFUND' | 'EXPENSE' | 'UDHAR' | 'PAASA';
  amount: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  partyName?: string;
  note?: string;
  createdAt: string;
  method?: string;
};

export function TransactionsPage() {
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['txns', tab, q],
    queryFn: () => api.get<Txn[]>(`/api/payment?limit=100&type=${tab === 'all' ? '' : tab}${q ? `&search=${encodeURIComponent(q)}` : ''}`),
  });

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-5xl mx-auto space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Every payment, bill and refund</p>
        </div>
      </div>

      <Tabs tabs={[
        { id: 'all', label: 'All' },
        { id: 'PAYMENT', label: 'Payments' },
        { id: 'BILL', label: 'Bills' },
        { id: 'REFUND', label: 'Refunds' },
        { id: 'UDHAR', label: 'Khata' },
      ]} active={tab} onChange={setTab} />

      <Input placeholder="Search by party name, Txn ID…" leftAddon={<Search className="size-4" />}
        value={q} onChange={(e) => setQ(e.target.value)} />

      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<ReceiptIcon className="size-10" />} title="No transactions yet" hint="They'll appear here as you accept payments" />
      ) : (
        <Card>
          <div className="divide-y divide-gray-100">
            {(data ?? []).map(t => <TxnRow key={t.id} t={t} />)}
          </div>
        </Card>
      )}
    </div>
  );
}

function TxnRow({ t }: { t: Txn }) {
  const isCredit = t.type === 'PAYMENT' || t.type === 'PAASA';
  const isDebit = t.type === 'BILL' || t.type === 'UDHAR' || t.type === 'EXPENSE' || t.type === 'REFUND';
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
      <div className={cn('size-10 rounded-xl grid place-items-center shrink-0',
        isCredit ? 'bg-success-50 text-success-700' : isDebit ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-600')}>
        {isCredit ? <ArrowDownRight className="size-5" /> : <ArrowUpRight className="size-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-900 truncate text-sm">
          {t.partyName || t.type}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">{shortDate(t.createdAt)}</span>
          <Badge tone={t.status === 'COMPLETED' ? 'success' : t.status === 'PENDING' ? 'warning' : 'error'}>
            {t.status}
          </Badge>
          {t.method && <Badge tone="neutral">{t.method}</Badge>}
        </div>
      </div>
      <div className={cn('amount font-bold text-right', isCredit ? 'text-success-700' : 'text-gray-900')}>
        {isCredit ? '+' : ''}{inr(t.amount)}
      </div>
    </div>
  );
}
