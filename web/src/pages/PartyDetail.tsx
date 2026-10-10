import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Plus, Minus, Phone, MessageCircle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, Button, Avatar, Badge, Input, EmptyState, Skeleton } from '@/lib/ui';
import { inr, fullDateTime, cn } from '@/lib/utils';
import { useState } from 'react';

type Entry = { id: string; type: 'UDHAR' | 'PAASA'; amount: number; note?: string; createdAt: string };

export function PartyDetailPage() {
  const { partyId: id } = useParams({ strict: false }) as { partyId: string };
  const qc = useQueryClient();
  const nav = useNavigate();
  const party = useQuery({ queryKey: ['party', id], queryFn: () => api.get<{ id: string; name: string; phone?: string; balance: number }>(`/api/customer/${id}`) });
  const ledger = useQuery({ queryKey: ['ledger', id], queryFn: () => api.get<Entry[]>(`/api/customer/${id}/ledger`) });
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const add = useMutation({
    mutationFn: (type: 'UDHAR' | 'PAASA') => {
      const map: Record<string, string> = { UDHAR: 'CREDIT', PAASA: 'PAYMENT' };
      return api.post(`/api/customer/${id}/ledger`, {
        type: map[type] || type,
        amount: parseFloat(amount),
        note: note || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger', id] });
      qc.invalidateQueries({ queryKey: ['party', id] });
      qc.invalidateQueries({ queryKey: ['parties'] });
      setAmount(''); setNote('');
    },
  });

  if (party.isLoading) return <div className="p-8"><Skeleton className="h-32" /></div>;
  if (!party.data) return <div className="p-8 text-gray-500">Not found</div>;
  const p = party.data;

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-3xl mx-auto space-y-5">
      <button onClick={() => nav({ to: '/app/khata' })} className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Khata
      </button>

      <Card className="overflow-hidden">
        <div className={cn('p-6 text-white',
          p.balance > 0 ? 'bg-gradient-to-br from-error-600 to-error-700' :
          p.balance < 0 ? 'bg-gradient-to-br from-success-600 to-success-700' :
          'bg-gradient-to-br from-brand-600 to-brand-700')}>
          <div className="flex items-center gap-3">
            <Avatar name={p.name} size={48} />
            <div>
              <div className="font-bold text-lg">{p.name}</div>
              {p.phone && <div className="text-sm text-white/80">{p.phone}</div>}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xs text-white/70 uppercase tracking-wide font-semibold">
              {p.balance > 0 ? 'They owe you' : p.balance < 0 ? 'You owe them' : 'Settled up'}
            </div>
            <div className="amount text-4xl font-bold mt-1">{inr(Math.abs(p.balance))}</div>
          </div>
          <div className="flex gap-2 mt-4">
            {p.phone && <a href={`tel:${p.phone}`} className="flex-1 bg-white/15 hover:bg-white/25 rounded-lg py-2 text-center text-sm font-semibold inline-flex items-center justify-center gap-1.5"><Phone className="size-4" /> Call</a>}
            {p.phone && <a href={`https://wa.me/${p.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi ${p.name}, your khata balance with us is ${inr(p.balance)}.`)}`}
              target="_blank" rel="noreferrer"
              className="flex-1 bg-white/15 hover:bg-white/25 rounded-lg py-2 text-center text-sm font-semibold inline-flex items-center justify-center gap-1.5">
              <MessageCircle className="size-4" /> WhatsApp
            </a>}
          </div>
        </div>
      </Card>

      {/* Quick entry */}
      <Card>
        <CardBody>
          <h3 className="font-semibold text-gray-900 mb-3">Add entry</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="0" />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" size="lg" onClick={() => add.mutate('UDHAR')} loading={add.isPending} disabled={!amount}>
              <Minus className="size-4" /> Udhar diya
            </Button>
            <Button variant="success" size="lg" onClick={() => add.mutate('PAASA')} loading={add.isPending} disabled={!amount}>
              <Plus className="size-4" /> Paasa mila
            </Button>
          </div>
          <div className="text-[11px] text-gray-400 mt-2 text-center">Tap an action to log instantly</div>
        </CardBody>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Ledger</h3>
          <Badge tone="neutral">{(ledger.data ?? []).length} entries</Badge>
        </div>
        {(ledger.data ?? []).length === 0 ? (
          <EmptyState icon={<ArrowUpRight className="size-10" />} title="No entries yet" hint="Use the buttons above to log the first one" />
        ) : (
          <div className="divide-y divide-gray-100">
            {(ledger.data ?? []).map(e => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className={cn('size-9 rounded-lg grid place-items-center',
                  e.type === 'UDHAR' ? 'bg-error-50 text-error-700' : 'bg-success-50 text-success-700')}>
                  {e.type === 'UDHAR' ? <Minus className="size-4" /> : <Plus className="size-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">
                    {e.type === 'UDHAR' ? 'Udhar diya' : 'Paasa mila'}
                  </div>
                  <div className="text-xs text-gray-500">{fullDateTime(e.createdAt)}{e.note && ` • ${e.note}`}</div>
                </div>
                <div className={cn('amount font-bold', e.type === 'UDHAR' ? 'text-error-700' : 'text-success-700')}>
                  {inr(e.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
