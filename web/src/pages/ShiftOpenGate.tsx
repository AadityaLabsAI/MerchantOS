import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Play, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, CardBody, Input } from '@/lib/ui';

export function ShiftOpenGate({ children }: { children: React.ReactNode }) {
  const [dismissed, setDismissed] = useState(false);
  const [openingCash, setOpeningCash] = useState('0');
  const qc = useQueryClient();

  const { data: current, isLoading } = useQuery({
    queryKey: ['shift-current'],
    queryFn: () => api.get<{ open: boolean; shiftId?: string; openedAt?: string; openingCash?: number }>('/api/shift/current'),
    refetchInterval: 60_000,
  });

  const openShift = useMutation({
    mutationFn: (opening_cash: number) => api.post('/api/shift/open', { openingCash: opening_cash }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-current'] }),
  });

  const closeShift = useMutation({
    mutationFn: (closing_cash: number) => api.post(`/api/shift/${current?.shiftId}/close`, { closingCash: closing_cash }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-current'] }),
  });

  if (isLoading) return <div className="p-8 text-gray-500">Loading shift…</div>;
  if (current?.open) return <>{children}</>;
  if (dismissed) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm grid place-items-center p-4">
      <Card className="max-w-md w-full shadow-elevated">
        <CardBody className="text-center">
          <div className="size-14 rounded-2xl bg-accent-100 text-accent-600 grid place-items-center mx-auto mb-4">
            <Clock className="size-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Open your shift</h2>
          <p className="text-sm text-gray-500 mb-6">
            Counting the cash in your drawer at the start of the day lets you reconcile the day\'s takings accurately.
          </p>
          <div className="text-left">
            <Input type="number" label="Opening cash in drawer (₹)" value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)} placeholder="0" />
          </div>
          <Button variant="accent" size="lg" full className="mt-5" loading={openShift.isPending}
            onClick={() => openShift.mutate(parseFloat(openingCash) || 0)}>
            <Play className="size-4" /> Open shift
          </Button>
          <button onClick={() => setDismissed(true)}
            className="mt-3 text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
            Skip for now <ArrowRight className="size-3" />
          </button>
        </CardBody>
      </Card>
    </div>
  );
}
