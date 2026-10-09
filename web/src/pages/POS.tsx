import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Minus, X, ShoppingCart, User, Tag, Percent, Trash2,
  Receipt as ReceiptIcon, QrCode, Wallet, CreditCard, ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, CardBody, Input, Badge, Avatar, EmptyState } from '@/lib/ui';
import { inr, cn } from '@/lib/utils';

type Product = { id: string; name: string; sku?: string; price: number; stock: number; category?: string };
type Customer = { id: string; name: string; balance?: number };
type CartLine = { product: Product; qty: number };

export function POSPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [showCustPicker, setShowCustPicker] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [discount, setDiscount] = useState(0); // percent

  const products = useQuery({
    queryKey: ['products-pos', search],
    queryFn: () => api.get<Product[]>(`/api/product?limit=200${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  });

  const customers = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => api.get<Customer[]>(`/api/customer?limit=200`),
    enabled: showCustPicker,
  });

  function addToCart(p: Product) {
    setCart(prev => {
      const ex = prev.find(c => c.product.id === p.id);
      if (ex) return prev.map(c => c.product.id === p.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { product: p, qty: 1 }];
    });
  }
  function changeQty(id: string, delta: number) {
    setCart(prev => prev.flatMap(c => c.product.id === id
      ? (c.qty + delta <= 0 ? [] : [{ ...c, qty: c.qty + delta }])
      : [c]));
  }
  function remove(id: string) { setCart(prev => prev.filter(c => c.product.id !== id)); }

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.product.price * l.qty, 0), [cart]);
  const discountAmt = subtotal * discount / 100;
  const total = subtotal - discountAmt;

  const checkout = useMutation({
    mutationFn: () => api.post('/api/bill', {
      customerId: customer?.id,
      lines: cart.map(c => ({ productId: c.product.id, qty: c.qty, price: c.product.price })),
      discountPercent: discount || undefined,
      paymentMethod: 'CASH',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products-pos'] });
      qc.invalidateQueries({ queryKey: ['reports-today'] });
      setCart([]); setCustomer(null); setDiscount(0); setShowPay(false);
    },
  });

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen grid grid-cols-1 lg:grid-cols-[1fr_400px]">
      {/* LEFT: catalog */}
      <div className="flex flex-col min-h-0 bg-white">
        <div className="px-4 lg:px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <Search className="size-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="flex-1 bg-transparent outline-none text-sm" />
          {products.data && <Badge tone="neutral">{products.data.length}</Badge>}
        </div>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 no-scrollbar">
          {products.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => <div key={i} className="aspect-square bg-gray-100 animate-pulse rounded-xl" />)}
            </div>
          ) : (products.data ?? []).length === 0 ? (
            <EmptyState icon={<ReceiptIcon className="size-10" />} title="No products yet" hint="Add your first product to start selling" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {(products.data ?? []).map(p => (
                <button key={p.id} onClick={() => addToCart(p)}
                  className="aspect-square text-left bg-white border border-gray-100 hover:border-brand-200 hover:shadow-card rounded-xl p-3 flex flex-col justify-between transition-all group">
                  <div>
                    <div className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{p.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{p.sku || ''}</div>
                  </div>
                  <div>
                    <div className="amount font-bold text-gray-900">{inr(p.price)}</div>
                    <div className={cn('text-[10px] mt-0.5', p.stock <= 5 ? 'text-error-600 font-semibold' : 'text-gray-400')}>
                      {p.stock <= 0 ? 'Out of stock' : `${p.stock} left`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: cart */}
      <div className="bg-white border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col min-h-0">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-brand-600" />
            <h2 className="font-bold text-gray-900">Current bill</h2>
            {cart.length > 0 && <Badge tone="brand">{cart.reduce((s, l) => s + l.qty, 0)} items</Badge>}
          </div>
          <button onClick={() => setShowCustPicker(true)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            {customer ? <><Avatar name={customer.name} size={24} /> <span className="font-medium">{customer.name}</span></> :
              <><User className="size-4" /> Add customer</>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1 no-scrollbar">
          {cart.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="size-10" />} title="Cart is empty" hint="Tap products on the left to add them" />
          ) : cart.map(line => (
            <div key={line.product.id} layout className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 group">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate text-sm">{line.product.name}</div>
                <div className="text-xs text-gray-500 amount">{inr(line.product.price)} × {line.qty}</div>
              </div>
              <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => changeQty(line.product.id, -1)}
                  className="size-7 grid place-items-center hover:bg-white rounded-md"><Minus className="size-3.5" /></button>
                <span className="w-6 text-center text-sm font-semibold">{line.qty}</span>
                <button onClick={() => changeQty(line.product.id, +1)}
                  className="size-7 grid place-items-center hover:bg-white rounded-md"><Plus className="size-3.5" /></button>
              </div>
              <div className="amount font-bold text-gray-900 w-20 text-right">{inr(line.product.price * line.qty)}</div>
              <button onClick={() => remove(line.product.id)} className="text-gray-300 hover:text-error-600"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50/40">
          <div className="space-y-1.5 text-sm">
            <Row label="Subtotal" value={inr(subtotal)} muted />
            {discount > 0 && <Row label={`Discount (${discount}%)`} value={`-${inr(discountAmt)}`} muted />}
            <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between">
              <span className="text-gray-900 font-semibold">Total</span>
              <span className="amount text-2xl font-bold text-gray-900">{inr(total)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setDiscount(d => Math.min(100, d + 5))}
              className="text-xs px-2.5 py-1 rounded-md bg-white border border-gray-200 hover:bg-gray-50">+5%</button>
            <button onClick={() => setDiscount(d => Math.max(0, d - 5))}
              className="text-xs px-2.5 py-1 rounded-md bg-white border border-gray-200 hover:bg-gray-50">−5%</button>
            <span className="text-xs text-gray-500 ml-auto">Discount: <b>{discount}%</b></span>
          </div>

          <Button size="xl" full variant="success" disabled={cart.length === 0} loading={checkout.isPending}
            onClick={() => setShowPay(true)}>
            Charge {inr(total)} <ArrowRight className="size-5" />
          </Button>
        </div>
      </div>

      
        {showCustPicker && (
          <CustomerPicker customers={customers.data ?? []} onPick={(c) => { setCustomer(c); setShowCustPicker(false); }}
            onClose={() => setShowCustPicker(false)} />
        )}
        {showPay && (
          <PaySheet total={total} customer={customer} onClose={() => setShowPay(false)}
            onConfirm={(method) => { checkout.mutate(); }} />
        )}
      
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-gray-500' : 'text-gray-900'}>{label}</span>
      <span className={cn('amount', muted ? 'text-gray-600' : 'text-gray-900 font-semibold')}>{value}</span>
    </div>
  );
}

function CustomerPicker({ customers, onPick, onClose }: { customers: Customer[]; onPick: (c: Customer) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const filtered = customers.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-end lg:place-items-center p-0 lg:p-4">
      <div className="bg-white w-full max-w-md rounded-t-2xl lg:rounded-2xl shadow-elevated max-h-[80vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-lg">Pick a customer</h3>
          <button onClick={onClose}><X className="size-5" /></button>
        </div>
        <div className="p-3"><Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} leftAddon={<Search className="size-4" />} /></div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-8">No customers yet</div>
          ) : filtered.map(c => (
            <button key={c.id} onClick={() => onPick(c)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl">
              <Avatar name={c.name} size={36} />
              <span className="font-medium text-gray-900">{c.name}</span>
              {c.balance != null && c.balance !== 0 && (
                <span className={cn('ml-auto amount text-sm font-bold', c.balance > 0 ? 'text-error-700' : 'text-success-700')}>
                  {inr(c.balance)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PaySheet({ total, customer, onClose, onConfirm }: {
  total: number; customer: Customer | null; onClose: () => void;
  onConfirm: (method: 'CASH' | 'UPI' | 'CARD') => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-end lg:place-items-center p-0 lg:p-4">
      <div className="bg-white w-full max-w-md rounded-t-2xl lg:rounded-2xl shadow-elevated">
        <div className="p-5 text-center border-b border-gray-100">
          <p className="text-sm text-gray-500">Total to collect</p>
          <div className="amount text-4xl font-bold text-gray-900">{inr(total)}</div>
          {customer && <p className="text-sm text-gray-500 mt-1">for {customer.name}</p>}
        </div>
        <div className="p-4 space-y-2.5">
          {[
            { m: 'UPI', label: 'UPI / QR', icon: <QrCode className="size-5" />, hint: 'Generate QR for customer' },
            { m: 'CASH', label: 'Cash', icon: <Wallet className="size-5" />, hint: 'Mark received in cash' },
            { m: 'CARD', label: 'Card', icon: <CreditCard className="size-5" />, hint: 'Swipe / tap card' },
          ].map((p, i) => (
            <button key={i} onClick={() => onConfirm(p.m as any)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-brand-500 hover:bg-brand-50 transition-colors text-left">
              <div className="size-10 rounded-lg bg-brand-50 text-brand-600 grid place-items-center">{p.icon}</div>
              <div>
                <div className="font-semibold text-gray-900">{p.label}</div>
                <div className="text-xs text-gray-500">{p.hint}</div>
              </div>
              <ArrowRight className="size-4 text-gray-400 ml-auto" />
            </button>
          ))}
        </div>
        <div className="p-4 pt-0">
          <button onClick={onClose} className="w-full text-sm text-gray-500 py-2">Cancel</button>
        </div>
      </div>
    </div>
  );
}
