import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Play, Square } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, CardBody, Button, Input, Badge, EmptyState, Skeleton } from '@/lib/ui';
import { fullDateTime } from '@/lib/utils';
import { useToast } from '@/lib/toast';

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

      {current?.open ? (
        <OpenShiftCard current={current} />
      ) : (
        <ClosedShiftCard />
      )}

      {isLoading ? <Skeleton className="h-32" />
        : <Card><EmptyState icon={<Clock className="size-10" />} title="Shift history" hint="Past shifts will appear here" /></Card>}
    </div>
  );
}

function OpenShiftCard({ current }: { current: { shiftId: string; openedAt: string; openingCash: number } }) {
  const [closing, setClosing] = useState('');
  const qc = useQueryClient();
  const toast = useToast();
  const closeShift = useMutation({
    mutationFn: () => api.post<{ totalSales: number }>(`/api/shift/${current.shiftId}/close`, { closingCash: parseFloat(closing) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift-current'] }); qc.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Shift closed — counted and reconciled'); setClosing(''); },
    onError: (e: any) => toast.error(e?.body?.error?.message ?? 'Could not close shift'),
  });
  return (
    <>
      <Card className="bg-success-50 border-success-200">
        <CardBody className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-success-100 text-success-700 grid place-items-center"><Play className="size-5" /></div>
          <div className="flex-1">
            <div className="font-bold text-success-900">Shift is open</div>
            <div className="text-sm text-success-700">Started {fullDateTime(current.openedAt)}</div>
          </div>
          <Badge tone="success">live</Badge>
        </CardBody>
      </Card>
      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-bold text-gray-900">Close shift</h2>
          <p className="text-sm text-gray-500">Count the cash in your drawer and enter it below. The system will tell you if anything's off.</p>
          <Input label="Closing cash in drawer (₹)" type="number" value={closing}
            onChange={(e) => setClosing(e.target.value)} placeholder="0" />
          <Button size="lg" full variant="danger" loading={closeShift.isPending}
            onClick={() => closeShift.mutate()} disabled={!closing}>
            <Square className="size-4" /> Close & reconcile
          </Button>
        </CardBody>
      </Card>
    </>
  );
}

function ClosedShiftCard() {
  const [opening, setOpening] = useState('0');
  const qc = useQueryClient();
  const toast = useToast();
  const openShift = useMutation({
    mutationFn: () => api.post<{ ok: boolean; shiftId: string }>('/api/shift/open', { openingCash: parseFloat(opening) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift-current'] }); qc.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Shift opened — you can start selling'); },
    onError: (e: any) => toast.error(e?.body?.error?.message ?? 'Could not open shift'),
  });
  return (
    <Card>
      <CardBody className="space-y-4">
        <h2 className="font-bold text-gray-900">Open your shift</h2>
        <p className="text-sm text-gray-500">
          Counting the cash in your drawer at the start of the day lets you reconcile the day's takings accurately. Enter the amount you counted.
        </p>
        <Input label="Opening cash in drawer (₹)" type="number" value={opening}
          onChange={(e) => setOpening(e.target.value)} placeholder="0" />
        <Button size="lg" full variant="success" loading={openShift.isPending}
          onClick={() => openShift.mutate()}>
          <Play className="size-4" /> Open shift
        </Button>
      </CardBody>
    </Card>
  );
}
