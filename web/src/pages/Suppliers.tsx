import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Truck, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, Button, Input, Avatar, EmptyState, Skeleton } from '@/lib/ui';
import { inr } from '@/lib/utils';

type Supplier = { id: string; name: string; phone?: string; balance?: number };

export function SuppliersPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get<Supplier[]>('/api/supplier') });

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-5xl mx-auto space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-0.5">सप्लायर — who you buy from</p>
        </div>
        <Button variant="accent" size="lg" onClick={() => setShowAdd(true)}><Plus className="size-4" /> Add supplier</Button>
      </div>

      {isLoading ? <Skeleton className="h-32" />
        : (data ?? []).length === 0 ? <EmptyState icon={<Truck className="size-10" />} title="No suppliers yet" hint="Add your first supplier to track payables and orders" />
        : (
          <Card>
            <div className="divide-y divide-gray-100">
              {(data ?? []).map(s => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={s.name} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.phone || '—'}</div>
                  </div>
                  {s.balance != null && <div className="amount font-bold text-gray-900">{inr(s.balance)}</div>}
                </div>
              ))}
            </div>
          </Card>
        )}
      {showAdd && <AddSupplierSheet onClose={() => setShowAdd(false)} onAdded={() => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setShowAdd(false); }} />}
    </div>
  );
}

function AddSupplierSheet({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const create = useMutation({ mutationFn: () => api.post('/api/supplier', { name, phone: phone || undefined }), onSuccess: onAdded });
  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-end lg:place-items-center p-0 lg:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl lg:rounded-2xl shadow-elevated p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4">Add supplier</h3>
        <div className="space-y-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button full size="lg" loading={create.isPending} onClick={() => create.mutate()} disabled={!name}>Add</Button>
        </div>
      </div>
    </div>
  );
}
