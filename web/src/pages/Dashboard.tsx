import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  TrendingUp, QrCode, BookOpen, Receipt as ReceiptIcon, ArrowUpRight, ArrowDownRight,
  Package, Users, Clock, AlertTriangle, Bell, Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, BigMoney, Button, Avatar, Badge, Skeleton } from '@/lib/ui';
import { inr, shortDate, cn } from '@/lib/utils';

type Today = { totalSales: number; totalSalesCount: number; payments: number; paymentsCount: number; refunds: number; refundsCount: number; outstandingKhata: number };
type TopProduct = { productId: string; name: string; qty: number; revenue: number };
type Outstanding = { customerId: string; name: string; balance: number; lastTxnAt?: string };

export function DashboardPage() {
  const today = useQuery({ queryKey: ['reports-today'], queryFn: () => api.get<Today>('/api/reports/today') });
  const top = useQuery({ queryKey: ['reports-top'], queryFn: () => api.get<TopProduct[]>('/api/reports/top-products?limit=5') });
  const khata = useQuery({ queryKey: ['reports-khata'], queryFn: () => api.get<Outstanding[]>('/api/reports/outstanding-khata?limit=5') });
  const lowStock = useQuery({ queryKey: ['low-stock'], queryFn: () => api.get<{ items: any[]; count: number; totalReorderCost: number }>('/api/product/low-stock') });

  const loading = today.isLoading;

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-gray-500">Good day</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Your shop at a glance</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/app/accept">
            <Button variant="success" size="lg">
              <QrCode className="size-5" /> Accept payment
            </Button>
          </Link>
        </div>
      </div>

      {/* LOW STOCK ALERT BANNER */}
      {lowStock.data && lowStock.data.count > 0 && (
        <Link to="/app/products">
          <div className="bg-gradient-to-r from-warning-500 to-warning-600 text-white rounded-xl p-4 flex items-center gap-3 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
            <div className="size-10 rounded-full bg-white/20 grid place-items-center shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{lowStock.data.count} items low on stock</div>
              <div className="text-sm text-white/90 truncate">
                Reorder cost: {inr(lowStock.data.totalReorderCost)} · Tap to see & restock
              </div>
            </div>
            <div className="text-2xl shrink-0">→</div>
          </div>
        </Link>
      )}

      {/* HERO STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          loading={loading}
          label="Today\'s sales"
          labelHi="आज की बिक्री"
          value={today.data?.totalSales ?? 0}
          sub={`${today.data?.totalSalesCount ?? 0} bills`}
          icon={<TrendingUp className="size-5" />}
          tone="brand"
        />
        <StatCard
          loading={loading}
          label="Payments received"
          labelHi="भुगतान प्राप्त"
          value={today.data?.payments ?? 0}
          sub={`${today.data?.paymentsCount ?? 0} txns`}
          icon={<Wallet className="size-5" />}
          tone="success"
        />
        <StatCard
          loading={loading}
          label="Outstanding khata"
          labelHi="बकाया उधार"
          value={today.data?.outstandingKhata ?? 0}
          sub="customers owe you"
          icon={<BookOpen className="size-5" />}
          tone="warning"
        />
        <StatCard
          loading={loading}
          label="Refunds"
          labelHi="रिफ़ंड"
          value={today.data?.refunds ?? 0}
          sub={`${today.data?.refundsCount ?? 0} txns`}
          icon={<ArrowDownRight className="size-5" />}
          tone="error"
        />
      </div>

      {/* TWO-COLUMN MAIN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* LEFT: top selling + khata */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* Quick actions grid */}
          <Card>
            <CardBody>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { to: '/app/accept', label: 'Accept payment', icon: <QrCode className="size-5" />, color: 'bg-success-50 text-success-700' },
                  { to: '/app/pos', label: 'New bill', icon: <ReceiptIcon className="size-5" />, color: 'bg-brand-50 text-brand-700' },
                  { to: '/app/khata', label: 'Add udhar', icon: <BookOpen className="size-5" />, color: 'bg-warning-50 text-warning-700' },
                  { to: '/app/products', label: 'Add stock', icon: <Package className="size-5" />, color: 'bg-accent-50 text-accent-700' },
                ].map(q => (
                  <Link key={q.to} to={q.to}
                    className="flex flex-col items-start gap-2 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-soft transition-all">
                    <div className={cn('size-9 rounded-lg grid place-items-center', q.color)}>{q.icon}</div>
                    <div className="text-sm font-semibold text-gray-900">{q.label}</div>
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Top products */}
          <Card>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Top selling today</h3>
              <Link to="/app/reports" className="text-xs text-brand-600 font-semibold">View all →</Link>
            </div>
            <div className="divide-y divide-gray-100">
              {top.isLoading ? (
                <div className="p-5 space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (top.data ?? []).length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-500">No sales today yet. Accept your first payment →</div>
              ) : (top.data ?? []).map((p, i) => (
                <div key={p.productId} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="size-9 rounded-lg bg-brand-50 text-brand-700 font-bold grid place-items-center text-sm shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.qty} units sold</div>
                  </div>
                  <div className="amount font-bold text-gray-900">{inr(p.revenue)}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Outstanding khata */}
          <Card>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Customers who owe you</h3>
              <Link to="/app/khata" className="text-xs text-brand-600 font-semibold">All khata →</Link>
            </div>
            <div className="divide-y divide-gray-100">
              {khata.isLoading ? (
                <div className="p-5 space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (khata.data ?? []).length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-500">No outstanding credit. Everyone has paid up.</div>
              ) : (khata.data ?? []).map(o => (
                <Link key={o.customerId} to="/app/khata/$partyId" params={{ partyId: o.customerId }}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <Avatar name={o.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{o.name}</div>
                    <div className="text-xs text-gray-500">{o.lastTxnAt ? `Last: ${shortDate(o.lastTxnAt)}` : 'New customer'}</div>
                  </div>
                  <div className="text-right">
                    <div className="amount font-bold text-error-700">{inr(o.balance)}</div>
                    <Badge tone="error" className="mt-0.5">due</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT: insights / tips / compliance */}
        <div className="space-y-4 lg:space-y-6">
          {/* Compliance card */}
          <Card className="bg-gradient-to-br from-brand-600 to-brand-700 text-white border-0">
            <CardBody>
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-xl bg-white/15 backdrop-blur grid place-items-center">
                  <Bell className="size-5" />
                </div>
                <div>
                  <div className="font-semibold">NPCI compliant</div>
                  <div className="text-xs text-white/70">Your shop is UPI-ready</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
                <Stat n="0%" label="Commission" />
                <Stat n="15s" label="Setup time" />
                <Stat n="100%" label="Self-hosted" />
              </div>
            </CardBody>
          </Card>

          {/* Tips card */}
          <Card>
            <CardBody>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="size-4 text-accent-500" />
                Tip of the day
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-900">Send a WhatsApp reminder</span> to customers who haven\'t paid in 7+ days. One tap from the khata screen.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ loading, label, labelHi, value, sub, icon, tone }: {
  loading: boolean; label: string; labelHi: string; value: number; sub: string;
  icon: React.ReactNode;
  tone: 'brand' | 'success' | 'warning' | 'error';
}) {
  const toneClasses = {
    brand:   'bg-brand-50 text-brand-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    error:   'bg-error-50 text-error-700',
  };
  return (
    <div>
      <Card>
        <CardBody className="!p-4">
          <div className="flex items-center justify-between mb-2">
            <div className={cn('size-9 rounded-lg grid place-items-center', toneClasses[tone])}>{icon}</div>
          </div>
          <div className="text-xs text-gray-500 font-medium">{label}</div>
          <div className="text-[10px] text-gray-400 -mt-0.5">{labelHi}</div>
          {loading ? <Skeleton className="h-8 w-24 mt-1.5" /> :
            <div className="amount font-bold text-2xl text-gray-900 mt-1">{inr(value)}</div>}
          <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-lg py-2 px-1">
      <div className="amount font-bold text-lg leading-none">{n}</div>
      <div className="text-white/70 mt-0.5">{label}</div>
    </div>
  );
}
