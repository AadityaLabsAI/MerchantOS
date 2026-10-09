import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Package, AlertTriangle, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, Button, Input, Badge, EmptyState, Skeleton } from '@/lib/ui';
import { inr, cn } from '@/lib/utils';

type Product = { id: string; name: string; sku?: string; price: number; stock: number; category?: string };

export function ProductsPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['products', q],
    queryFn: () => api.get<Product[]>(`/api/product?limit=200${q ? `&search=${encodeURIComponent(q)}` : ''}`),
  });
  const lowStock = (data ?? []).filter(p => p.stock > 0 && p.stock <= 5).length;
  const outOfStock = (data ?? []).filter(p => p.stock <= 0).length;
  const totalValue = (data ?? []).reduce((s, p) => s + p.price * p.stock, 0);

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-5xl mx-auto space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">सामान — what you sell</p>
        </div>
        <Button variant="accent" size="lg" onClick={() => setShowAdd(true)}><Plus className="size-4" /> Add product</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardBody className="!p-4">
          <div className="text-xs text-gray-500">Total items</div>
          <div className="amount text-2xl font-bold text-gray-900 mt-1">{(data ?? []).length}</div>
        </CardBody></Card>
        <Card><CardBody className="!p-4">
          <div className="text-xs text-gray-500">Inventory value</div>
          <div className="amount text-2xl font-bold text-brand-700 mt-1">{inr(totalValue)}</div>
        </CardBody></Card>
        <Card><CardBody className="!p-4">
          <div className="text-xs text-gray-500">Needs restock</div>
          <div className="amount text-2xl font-bold text-warning-700 mt-1">{lowStock + outOfStock}</div>
          <div className="text-[11px] text-gray-400">{outOfStock} out of stock</div>
        </CardBody></Card>
      </div>

      <Input placeholder="Search products…" leftAddon={<Search className="size-4" />}
        value={q} onChange={(e) => setQ(e.target.value)} />

      {isLoading ? <div className="space-y-2">{[...Array(6)].map((_,i)=><Skeleton key={i} className="h-16" />)}</div>
        : (data ?? []).length === 0 ? <EmptyState icon={<Package className="size-10" />} title="No products yet" hint="Add what you sell — it's faster than typing at the counter" />
        : (
          <Card>
            <div className="divide-y divide-gray-100">
              {(data ?? []).map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                    <Package className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.sku || '—'} • {p.category || 'Uncategorized'}</div>
                  </div>
                  <div className="text-right">
                    <div className="amount font-bold text-gray-900">{inr(p.price)}</div>
                    <div className={cn('text-xs font-medium', p.stock <= 0 ? 'text-error-600' : p.stock <= 5 ? 'text-warning-700' : 'text-gray-500')}>
                      {p.stock <= 0 ? <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3" /> Out of stock</span> : `${p.stock} in stock`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

      {showAdd && <AddProductSheet onClose={() => setShowAdd(false)} onAdded={() => { qc.invalidateQueries({ queryKey: ['products'] }); setShowAdd(false); }} />}
    </div>
  );
}

function AddProductSheet({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState(''); const [price, setPrice] = useState(''); const [stock, setStock] = useState('0');
  const create = useMutation({
    mutationFn: () => api.post('/api/product', { name, price: parseFloat(price), stock: parseInt(stock) }),
    onSuccess: onAdded,
  });
  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-end lg:place-items-center p-0 lg:p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-2xl lg:rounded-2xl shadow-elevated p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4">Add product</h3>
        <div className="space-y-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tata Salt 1kg" />
          <Input label="Price (₹)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input label="Stock" type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          <Button full size="lg" loading={create.isPending} onClick={() => create.mutate()} disabled={!name || !price}>Add product</Button>
        </div>
      </div>
    </div>
  );
}
