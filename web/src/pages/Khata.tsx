import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Search, Plus, MessageCircle, Phone, TrendingUp, TrendingDown, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, Input, Button, Avatar, Badge, EmptyState, Skeleton } from '@/lib/ui';
import { inr, cn } from '@/lib/utils';

type Party = { id: string; name: string; phone?: string; balance: number; lastTxnAt?: string };

export function KhataPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['parties', q],
    queryFn: () => api.get<Party[]>(`/api/customer?limit=200${q ? `&search=${encodeURIComponent(q)}` : ''}`),
  });

  const totalDue = (data ?? []).filter(p => p.balance > 0).reduce((s, p) => s + p.balance, 0);
  const totalAdvance = (data ?? []).filter(p => p.balance < 0).reduce((s, p) => s + Math.abs(p.balance), 0);
  const netOwed = totalDue - totalAdvance;

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-5xl mx-auto space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Khata — Party Ledger</h1>
          <p className="text-sm text-gray-500 mt-0.5">खाता — track who owes whom</p>
        </div>
        <Button variant="accent" size="lg" onClick={() => setShowAdd(true)}>
          <Plus className="size-4" /> Add party
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardBody className="!p-4">
          <div className="text-xs text-gray-500 font-medium">You\'ll receive</div>
          <div className="amount text-2xl font-bold text-error-700 mt-1">{inr(totalDue)}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{(data ?? []).filter(p => p.balance > 0).length} parties</div>
        </CardBody></Card>
        <Card><CardBody className="!p-4">
          <div className="text-xs text-gray-500 font-medium">You owe</div>
          <div className="amount text-2xl font-bold text-success-700 mt-1">{inr(totalAdvance)}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{(data ?? []).filter(p => p.balance < 0).length} parties</div>
        </CardBody></Card>
        <Card><CardBody className="!p-4">
          <div className="text-xs text-gray-500 font-medium">Net</div>
          <div className={cn('amount text-2xl font-bold mt-1', netOwed >= 0 ? 'text-error-700' : 'text-success-700')}>
            {inr(netOwed)}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">in your favor</div>
        </CardBody></Card>
      </div>

      <Input placeholder="Search party name…" leftAddon={<Search className="size-4" />}
        value={q} onChange={(e) => setQ(e.target.value)} />

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState icon={<TrendingUp className="size-10" />} title="No parties yet" hint="Add a customer or supplier to start tracking credit" />
      ) : (
        <Card>
          <div className="divide-y divide-gray-100">
            {(data ?? []).map(p => (
              <Link key={p.id} to="/app/khata/$partyId" params={{ partyId: p.id }}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <Avatar name={p.name} size={42} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.lastTxnAt ? `Last: ${new Date(p.lastTxnAt).toLocaleDateString('en-IN')}` : 'New'}</div>
                </div>
                <div className="text-right">
                  {p.balance === 0 ? <Badge tone="neutral">Settled</Badge> : (
                    <>
                      <div className={cn('amount font-bold', p.balance > 0 ? 'text-error-700' : 'text-success-700')}>
                        {inr(Math.abs(p.balance))}
                      </div>
                      <div className="text-[11px] text-gray-500">{p.balance > 0 ? 'they owe' : 'you owe'}</div>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {showAdd && <AddPartySheet onClose={() => setShowAdd(false)} onAdded={() => { qc.invalidateQueries({queryKey:['parties']}); setShowAdd(false); }} />}
    </div>
  );
}

function AddPartySheet({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const create = useMutation({
    mutationFn: () => api.post('/api/customer', { name, phone: phone || undefined }),
    onSuccess: onAdded,
  });
  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-end lg:place-items-center p-0 lg:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl lg:rounded-2xl shadow-elevated p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Add party</h3>
          <button onClick={onClose}><X className="size-5" /></button>
        </div>
        <div className="space-y-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kirana" />
          <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />
          <Button full size="lg" loading={create.isPending} onClick={() => create.mutate()} disabled={!name}>Add party</Button>
        </div>
      </div>
    </div>
  );
}
