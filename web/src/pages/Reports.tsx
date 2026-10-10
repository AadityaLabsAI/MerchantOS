// Reports — today, top products, outstanding khata. No external chart libs
// (recharts was dropped from the build for size — we use plain CSS bars instead).
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, BarChart3, Wallet, BookOpen, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardBody, Tabs, Badge, EmptyState, Skeleton } from '@/lib/ui';
import { inr } from '@/lib/utils';

type Today = { totalSales: number; totalSalesCount: number; payments: number; paymentsCount: number; refunds: number; refundsCount: number; outstandingKhata: number; salesCount?: number };
type TopProduct = { productId: string; name: string; quantity: number; revenueMinor: string; currency: string };
type Outstanding = { customerId: string; name: string; balance: number; lastTxnAt?: string };

export function ReportsPage() {
  const { me } = useAuth();
  const storeId = me?.storeId ?? '';
  const [tab, setTab] = useState('today');
  const [days, setDays] = useState(7);

  const today = useQuery({
    queryKey: ['reports-today', storeId],
    queryFn: () => api.get<Today>(`/api/reports/today?storeId=${storeId}`),
    enabled: !!storeId,
  });
  const top = useQuery({
    queryKey: ['reports-top', storeId, days],
    queryFn: () => api.get<{ products: TopProduct[] }>(`/api/reports/top-products?storeId=${storeId}&days=${days}`),
    enabled: !!storeId,
  });
  const khata = useQuery({
    queryKey: ['reports-khata', storeId],
    queryFn: () => api.get<{ outstandingMinor: string; currency: string }>(`/api/reports/outstanding-khata?storeId=${storeId}`),
    enabled: !!storeId,
  });

  function exportCSV() {
    const rows = [['Metric', 'Value']];
    if (today.data) {
      rows.push(['Today total sales (INR)', String(today.data.totalSales || 0)]);
      rows.push(['Today bills count', String(today.data.totalSalesCount || 0)]);
      rows.push(['Today payments (INR)', String(today.data.payments || 0)]);
      rows.push(['Today refunds (INR)', String(today.data.refunds || 0)]);
    }
    if (khata.data) rows.push(['Outstanding khata (paise)', khata.data.outstandingMinor || '0']);
    if (top.data?.products) for (const p of top.data.products) rows.push([`${p.name} (qty)`, String(p.quantity)], [`${p.name} (revenue paise)`, p.revenueMinor]);
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `merchantos-${tab}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-5xl mx-auto space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">रिपोर्ट — your shop at a glance</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300">
          <Download className="size-4" /> Export CSV
        </button>
      </div>

      <Tabs tabs={[
        { id: 'today', label: 'Today' },
        { id: 'top', label: 'Top products' },
        { id: 'khata', label: 'Outstanding khata' },
      ]} active={tab} onChange={setTab} />

      {tab === 'today' && (
        <div className="space-y-4">
          {today.isLoading ? <Skeleton className="h-40" /> : today.data ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card><CardBody className="!p-5">
                  <div className="text-xs text-gray-500">Total sales</div>
                  <div className="amount text-2xl font-bold text-gray-900 mt-1">{inr(today.data.totalSales || 0)}</div>
                  <div className="text-[11px] text-gray-400">{today.data.totalSalesCount || 0} bills</div>
                </CardBody></Card>
                <Card><CardBody className="!p-5">
                  <div className="text-xs text-gray-500">Cash</div>
                  <div className="amount text-2xl font-bold text-success-700 mt-1">{inr(today.data.payments || 0)}</div>
                </CardBody></Card>
                <Card><CardBody className="!p-5">
                  <div className="text-xs text-gray-500">Refunds</div>
                  <div className="amount text-2xl font-bold text-error-700 mt-1">{inr(today.data.refunds || 0)}</div>
                  <div className="text-[11px] text-gray-400">{today.data.refundsCount || 0} txns</div>
                </CardBody></Card>
                <Card><CardBody className="!p-5">
                  <div className="text-xs text-gray-500">Outstanding khata</div>
                  <div className="amount text-2xl font-bold text-warning-700 mt-1">{inr(today.data.outstandingKhata || 0)}</div>
                </CardBody></Card>
              </div>
            </>
          ) : null}
        </div>
      )}

      {tab === 'top' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Window:</span>
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs rounded-full font-medium ${days === d ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {d}d
              </button>
            ))}
          </div>
          {top.isLoading ? <Skeleton className="h-40" /> : top.data?.products.length === 0 ? (
            <EmptyState icon={<TrendingUp className="size-10" />} title="No sales in this window" hint="Once you start selling, your top products will show here." />
          ) : (
            <TopProductsChart products={top.data!.products} />
          )}
        </div>
      )}

      {tab === 'khata' && (
        khata.isLoading ? <Skeleton className="h-40" /> : khata.data ? (
          <Card>
            <CardBody>
              <div className="flex items-center gap-4">
                <div className="size-14 rounded-2xl bg-warning-100 text-warning-700 grid place-items-center"><BookOpen className="size-7" /></div>
                <div>
                  <div className="text-sm text-gray-500">Total outstanding (customers owe you)</div>
                  <div className="amount text-3xl font-bold text-error-700">{inr(Number(khata.data.outstandingMinor || 0) / 100)}</div>
                </div>
              </div>
              <a href="/app/khata" className="text-sm text-brand-600 font-semibold mt-4 inline-block">View all parties →</a>
            </CardBody>
          </Card>
        ) : null
      )}
    </div>
  );
}

// Pure-CSS bar chart — no external library
function TopProductsChart({ products }: { products: TopProduct[] }) {
  const max = useMemo(() => Math.max(1, ...products.map(p => Number(BigInt(p.revenueMinor || '0')))), [products]);
  return (
    <Card>
      <div className="divide-y divide-gray-100">
        {products.slice(0, 10).map((p, i) => {
          const rev = Number(BigInt(p.revenueMinor || '0')) / 100;
          const pct = (Number(BigInt(p.revenueMinor || '0')) / max) * 100;
          return (
            <div key={p.productId} className="px-5 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-brand-50 text-brand-700 font-bold grid place-items-center text-xs shrink-0">{i + 1}</div>
                  <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="amount font-bold text-gray-900">{inr(rev)}</div>
                  <div className="text-[11px] text-gray-400">{p.quantity} sold</div>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
