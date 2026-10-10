// Customer-facing public view - accessed via /pay/cst_<id> token
// No auth required. Customer sees their own balance, statement, can pay via UPI.
import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Phone, MessageCircle, Store, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardBody, Avatar, Badge } from '@/lib/ui';
import { inr, fullDateTime, cn } from '@/lib/utils';

type Customer = { id: string; name: string; phone?: string; balance: number; lastTxnAt?: string };
type Entry = { id: string; type: 'CREDIT' | 'PAYMENT'; amount: number; note?: string; createdAt: string };
type Shop = { name: string; ownerName?: string; phone?: string; upiId?: string; address?: string; gst?: string };

export function CustomerViewPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [shop, setShop] = useState<Shop | null>(null);

  useEffect(() => {
    fetch('/api/public/customer/' + encodeURIComponent(id))
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: any) => {
        setCustomer(data.customer);
        setEntries(data.entries);
        setShop(data.shop);
      })
      .catch((e) => setError(e === 404 ? 'Link nahi mila' : 'Server error'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-800 grid place-items-center p-4">
        <Loader2 className="size-8 text-white animate-spin" />
      </div>
    );
  }
  if (error || !customer || !shop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-error-600 to-error-800 grid place-items-center p-4">
        <Card className="max-w-sm w-full text-center !p-8">
          <AlertCircle className="size-12 text-error-600 mx-auto" />
          <h2 className="font-bold text-lg mt-3">{error || 'Link nahi mila'}</h2>
          <p className="text-sm text-gray-500 mt-1">Please contact the shop</p>
        </Card>
      </div>
    );
  }

  const upiLink = shop.upiId
    ? `upi://pay?pa=${encodeURIComponent(shop.upiId)}&pn=${encodeURIComponent(shop.name)}&am=${Math.max(0, customer.balance)}&cu=INR&tn=${encodeURIComponent('Payment to ' + shop.name)}`
    : '#';

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100 p-4">
      <div className="max-w-md mx-auto space-y-4 py-4">
        <div className="text-center space-y-2">
          <div className="size-16 rounded-2xl bg-white shadow-md grid place-items-center mx-auto">
            <Store className="size-8 text-brand-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
          {shop.address && <p className="text-sm text-gray-500">{shop.address}</p>}
        </div>

        <Card className="overflow-hidden">
          <div className={cn('p-6 text-white text-center',
            customer.balance > 0 ? 'bg-gradient-to-br from-error-500 to-error-700' :
            customer.balance < 0 ? 'bg-gradient-to-br from-success-500 to-success-700' :
            'bg-gradient-to-br from-brand-500 to-brand-700')}>
            <div className="text-sm font-medium uppercase tracking-wider text-white/80">
              {customer.balance > 0 ? 'Aapka Bakiya' : customer.balance < 0 ? 'Aapka Advance' : 'Settled'}
            </div>
            <div className="amount text-5xl font-bold mt-2">{inr(Math.abs(customer.balance))}</div>
            <div className="text-sm text-white/80 mt-1">{customer.name}</div>
          </div>
          {customer.balance > 0 && shop.upiId && (
            <CardBody className="!p-4 bg-white">
              <a href={upiLink}
                className="block w-full bg-success-600 hover:bg-success-700 text-white font-bold text-center py-3 rounded-xl text-lg shadow-md">
                Abhi Pay Karein - {inr(customer.balance)}
              </a>
              <div className="text-[11px] text-center text-gray-400 mt-2">
                Pay via GPay, PhonePe, Paytm, BHIM UPI
              </div>
            </CardBody>
          )}
        </Card>

        <Card>
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Statement</h3>
            <Badge tone="neutral">{entries.length} entries</Badge>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {entries.slice(-15).reverse().map(e => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                <div className={cn('size-8 rounded-lg grid place-items-center text-xs font-bold',
                  e.type === 'CREDIT' ? 'bg-error-50 text-error-700' : 'bg-success-50 text-success-700')}>
                  {e.type === 'CREDIT' ? '+' : '-'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {e.type === 'CREDIT' ? 'Udhar liya' : 'Paasa diya'}
                  </div>
                  <div className="text-xs text-gray-500">{fullDateTime(e.createdAt)}</div>
                </div>
                <div className={cn('font-bold', e.type === 'CREDIT' ? 'text-error-700' : 'text-success-700')}>
                  {inr(e.amount)}
                </div>
              </div>
            ))}
            {entries.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">Koi entry nahi abhi</div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          {shop.phone && (
            <a href={`tel:${shop.phone}`} className="bg-white rounded-xl p-3 text-center shadow-sm font-semibold text-gray-900 inline-flex items-center justify-center gap-1.5">
              <Phone className="size-4" /> Call Shop
            </a>
          )}
          {shop.phone && (
            <a href={`https://wa.me/${shop.phone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
              className="bg-white rounded-xl p-3 text-center shadow-sm font-semibold text-gray-900 inline-flex items-center justify-center gap-1.5">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          )}
        </div>

        <div className="text-center text-xs text-gray-400 pt-2">
          Powered by <span className="font-bold text-brand-700">MerchantOS</span>
        </div>
      </div>
    </div>
  );
}
