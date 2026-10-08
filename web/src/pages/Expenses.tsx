import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CircleDollarSign } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, Button, Input, EmptyState, Skeleton } from '@/lib/ui';
import { inr, shortDate } from '@/lib/utils';

type Exp = { id: string; amount: number; category: string; note?: string; createdAt: string };

export function ExpensesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['expenses'], queryFn: () => api.get<Exp[]>('/api/expense?limit=100') });
  const total = (data ?? []).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-5xl mx-auto space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">खर्च — what you spent</p>
        </div>
        <Button variant="accent" size="lg" onClick={() => setShowAdd(true)}><Plus className="size-4" /> Add expense</Button>
      </div>

      <Card><CardBody>
        <div className="text-xs text-gray-500">This month total</div>
        <div className="amount text-3xl font-bold text-error-700 mt-1">{inr(total)}</div>
      </CardBody></Card>

      {isLoading ? <Skeleton className="h-32" />
        : (data ?? []).length === 0 ? <EmptyState icon={<CircleDollarSign className="size-10" />} title="No expenses logged" hint="Track rent, electricity, supplier payments here" />
        : (
          <Card>
            <div className="divide-y divide-gray-100">
              {(data ?? []).map(e => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="size-10 rounded-xl bg-error-50 text-error-700 grid place-items-center shrink-0">
                    <CircleDollarSign className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{e.category}</div>
                    <div className="text-xs text-gray-500">{shortDate(e.createdAt)}{e.note && ` • ${e.note}`}</div>
                  </div>
                  <div className="amount font-bold text-error-700">−{inr(e.amount)}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

      {showAdd && <AddExpenseSheet onClose={() => setShowAdd(false)} onAdded={() => { qc.invalidateQueries({ queryKey: ['expenses'] }); setShowAdd(false); }} />}
    </div>
  );
}

function AddExpenseSheet({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [amount, setAmount] = useState(''); const [category, setCategory] = useState('Rent'); const [note, setNote] = useState('');
  const create = useMutation({ mutationFn: () => api.post('/api/expense', { amount: parseFloat(amount), category, note: note || undefined }), onSuccess: onAdded });
  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-end lg:place-items-center p-0 lg:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl lg:rounded-2xl shadow-elevated p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4">Add expense</h3>
        <div className="space-y-3">
          <Input label="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button full size="lg" loading={create.isPending} onClick={() => create.mutate()} disabled={!amount}>Add</Button>
        </div>
      </div>
    </div>
  );
}
