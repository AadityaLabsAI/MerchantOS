import { useQuery } from '@tanstack/react-query';
import { Clock, Play, Square } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, Badge, EmptyState, Skeleton } from '@/lib/ui';
import { fullDateTime } from '@/lib/utils';

type Shift = { id: string; openedAt: string; closedAt?: string; openingCash: number; closingCash?: number };

export function ShiftsPage() {
  const { data: current } = useQuery({ queryKey: ['shift-current'], queryFn: () => api.get<{ open: boolean; shiftId?: string }>('/api/shift/current') });
  const { data, isLoading } = useQuery({ queryKey: ['shifts'], queryFn: () => api.get<Shift[]>('/api/shift/current') });

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shifts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Open / close register, count drawer</p>
      </div>

      {current?.open && (
        <Card className="bg-success-50 border-success-200">
          <CardBody className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-success-100 text-success-700 grid place-items-center"><Play className="size-5" /></div>
            <div className="flex-1">
              <div className="font-bold text-success-900">Shift is open</div>
              <div className="text-sm text-success-700">Started at {fullDateTime(current.shiftId || '')}</div>
            </div>
            <Badge tone="success">live</Badge>
          </CardBody>
        </Card>
      )}

      {isLoading ? <Skeleton className="h-32" />
        : <Card><EmptyState icon={<Clock className="size-10" />} title="Shift history" hint="Past shifts will appear here" /></Card>}
    </div>
  );
}
