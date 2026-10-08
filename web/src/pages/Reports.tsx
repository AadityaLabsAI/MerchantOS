import { useQuery } from '@tanstack/react-query';
import { TrendingUp, BarChart3, BookOpen, Wallet, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, Badge, EmptyState, Skeleton, Tabs } from '@/lib/ui';
import { useState } from 'react';
import { inr } from '@/lib/utils';

type Today = { totalSales: number; payments: number; refunds: number; outstandingKhata: number };

export function ReportsPage() {
  const [period, setPeriod] = useState('today');
  const today = useQuery({ queryKey: ['reports-today'], queryFn: () => api.get<Today>('/api/reports/today') });

  // Generate sample weekly data — would come from API
  const weekly = [
    { day: 'Mon', sales: 12400, payments: 9800 },
    { day: 'Tue', sales: 15200, payments: 12100 },
    { day: 'Wed', sales: 9800, payments: 8400 },
    { day: 'Thu', sales: 18600, payments: 15400 },
    { day: 'Fri', sales: 22300, payments: 19200 },
    { day: 'Sat', sales: 28100, payments: 24800 },
    { day: 'Sun', sales: 21400, payments: 18600 },
  ];

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">How your shop is doing</p>
      </div>

      <Tabs tabs={[
        { id: 'today', label: 'Today' },
        { id: 'week', label: 'This week' },
        { id: 'month', label: 'This month' },
      ]} active={period} onChange={setPeriod} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Sales" value={today.data?.totalSales} icon={<BarChart3 className="size-5" />} tone="brand" />
        <KPI label="Payments" value={today.data?.payments} icon={<Wallet className="size-5" />} tone="success" />
        <KPI label="Khata outstanding" value={today.data?.outstandingKhata} icon={<BookOpen className="size-5" />} tone="warning" />
        <KPI label="Refunds" value={today.data?.refunds} icon={<TrendingUp className="size-5" />} tone="error" />
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Sales vs payments</h3>
            <Badge tone="neutral">7 days</Badge>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={weekly}>
              <defs>
                <linearGradient id="gsales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gpay" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0F9D58" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0F9D58" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip formatter={(v: any) => inr(v)} contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB' }} />
              <Area type="monotone" dataKey="sales" stroke="#1E3A8A" fill="url(#gsales)" strokeWidth={2} />
              <Area type="monotone" dataKey="payments" stroke="#0F9D58" fill="url(#gpay)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Daily breakdown</h3>
            <Badge tone="neutral">₹ amounts</Badge>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip formatter={(v: any) => inr(v)} contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB' }} />
              <Bar dataKey="sales" fill="#1E3A8A" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    </div>
  );
}

function KPI({ label, value, icon, tone }: { label: string; value?: number; icon: React.ReactNode; tone: 'brand'|'success'|'warning'|'error' }) {
  const tones = {
    brand:   'bg-brand-50 text-brand-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    error:   'bg-error-50 text-error-700',
  };
  return (
    <div>
      <Card>
        <CardBody className="!p-4">
          <div className={`size-9 rounded-lg grid place-items-center mb-2 ${tones[tone]}`}>{icon}</div>
          <div className="text-xs text-gray-500 font-medium">{label}</div>
          {value === undefined ? <Skeleton className="h-7 w-20 mt-1.5" /> :
            <div className="amount text-2xl font-bold text-gray-900 mt-1">{inr(value)}</div>}
        </CardBody>
      </Card>
    </div>
  );
}
