import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Plus, Minus, Phone, MessageCircle, ArrowUpRight, Zap, FileText, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardBody, Button, Avatar, Badge, Input, EmptyState, Skeleton, Modal, Field } from '@/lib/ui';
import { inr, fullDateTime, cn } from '@/lib/utils';
import { useI18n, t } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { buildPaymentReminder, buildStatement, shareToWhatsApp } from '@/lib/whatsapp';
import { toast } from '@/lib/toast';

type Entry = { id: string; type: 'CREDIT' | 'PAYMENT'; amount: number; note?: string; createdAt: string; method?: string };

export function PartyDetailPage() {
  const { partyId: id } = useParams({ strict: false }) as { partyId: string };
  const qc = useQueryClient();
  const nav = useNavigate();
  const { locale } = useI18n();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkMethod, setBulkMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [shop, setShop] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { api('/api/shop/settings').then(setShop).catch(() => {}); }, []);

  const party = useQuery({
    queryKey: ['party', id],
    queryFn: () => api.get<{ id: string; name: string; phone?: string; balance: number }>(`/api/customer/${id}`),
  });
  const ledger = useQuery({
    queryKey: ['ledger', id],
    queryFn: () => api.get<Entry[]>(`/api/customer/${id}/ledger`),
  });

  const add = useMutation({
    mutationFn: (type: 'CREDIT' | 'PAYMENT') =>
      api.post(`/api/customer/${id}/ledger`, { type, amount: parseFloat(amount), note: note || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger', id] });
      qc.invalidateQueries({ queryKey: ['party', id] });
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setAmount(''); setNote('');
      toast.success(t('toast.saved', locale));
    },
  });

  const bulk = useMutation({
    mutationFn: () => api.post('/api/customer/bulk-pay', {
      customerId: id, amount: parseFloat(bulkAmount), note: bulkNote || undefined, method: bulkMethod,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger', id] });
      qc.invalidateQueries({ queryKey: ['party', id] });
      qc.invalidateQueries({ queryKey: ['parties'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowBulk(false);
      setBulkAmount(''); setBulkNote('');
      toast.success(t('toast.saved', locale));
    },
  });

  function shareReminder() {
    if (!party.data || !shop) return;
    const { url, text } = buildPaymentReminder(party.data, shop, locale);
    shareToWhatsApp(url);
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  function shareStatement() {
    if (!party.data || !shop || !ledger.data) return;
    const { url, text } = buildStatement(party.data, ledger.data, shop, locale);
    shareToWhatsApp(url);
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  function copyCustomerLink() {
    const link = `${window.location.origin}/pay/cst_${id}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      toast.success('Link copied! Share with customer');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (party.isLoading) return <div className="p-8"><Skeleton className="h-32" /></div>;
  if (!party.data) return <div className="p-8 text-gray-500">Not found</div>;
  const p = party.data;

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-3xl mx-auto space-y-5">
      <button onClick={() => nav({ to: '/app/khata' })} className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> {t('khata.title', locale)}
      </button>

      <Card className="overflow-hidden">
        <div className={cn('p-6 text-white',
          p.balance > 0 ? 'bg-gradient-to-br from-error-600 to-error-700' :
          p.balance < 0 ? 'bg-gradient-to-br from-success-600 to-success-700' :
          'bg-gradient-to-br from-brand-600 to-brand-700')}>
          <div className="flex items-center gap-3">
            <Avatar name={p.name} size={48} />
            <div className="flex-1">
              <div className="font-bold text-lg">{p.name}</div>
              {p.phone && <div className="text-sm text-white/80">{p.phone}</div>}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xs text-white/70 uppercase tracking-wide font-semibold">
              {p.balance > 0 ? t('khata.outstanding', locale) + ' (they owe)' : p.balance < 0 ? 'You owe them' : 'Settled'}
            </div>
            <div className="amount text-4xl font-bold mt-1">{inr(Math.abs(p.balance))}</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {p.phone && (
              <a href={`tel:${p.phone}`} className="bg-white/15 hover:bg-white/25 rounded-lg py-2 text-center text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                <Phone className="size-4" /> Call
              </a>
            )}
            {p.phone && (
              <button onClick={shareReminder} className="bg-white/15 hover:bg-white/25 rounded-lg py-2 text-center text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                <MessageCircle className="size-4" /> Remind
              </button>
            )}
            <button onClick={shareStatement} className="bg-white/15 hover:bg-white/25 rounded-lg py-2 text-center text-sm font-semibold inline-flex items-center justify-center gap-1.5">
              <FileText className="size-4" /> Statement
            </button>
            {p.balance > 0 && (
              <button onClick={() => setShowBulk(true)} className="bg-white/15 hover:bg-white/25 rounded-lg py-2 text-center text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                <Zap className="size-4" /> Bulk Pay
              </button>
            )}
          </div>
          <button onClick={copyCustomerLink} className="w-full mt-3 bg-white/10 hover:bg-white/20 rounded-lg py-2 text-xs font-medium inline-flex items-center justify-center gap-1.5">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Link copied!' : 'Copy customer link (no login needed)'}
          </button>
        </div>
      </Card>

      <Card>
        <CardBody>
          <h3 className="font-semibold text-gray-900 mb-3">Add entry</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="0" />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" size="lg" onClick={() => add.mutate('CREDIT')} loading={add.isPending} disabled={!amount}>
              <Minus className="size-4" /> {t('khata.udhar', locale)}
            </Button>
            <Button variant="success" size="lg" onClick={() => add.mutate('PAYMENT')} loading={add.isPending} disabled={!amount}>
              <Plus className="size-4" /> {t('khata.paasa', locale)}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Ledger</h3>
          <Badge tone="neutral">{(ledger.data ?? []).length} entries</Badge>
        </div>
        {(ledger.data ?? []).length === 0 ? (
          <EmptyState icon={<ArrowUpRight className="size-10" />} title="No entries yet" />
        ) : (
          <div className="divide-y divide-gray-100">
            {(ledger.data ?? []).map(e => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className={cn('size-9 rounded-lg grid place-items-center',
                  e.type === 'CREDIT' ? 'bg-error-50 text-error-700' : 'bg-success-50 text-success-700')}>
                  {e.type === 'CREDIT' ? <Minus className="size-4" /> : <Plus className="size-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">
                    {e.type === 'CREDIT' ? t('khata.udhar', locale) : t('khata.paasa', locale)}
                    {e.method && <span className="text-xs text-gray-400 ml-2">· {e.method}</span>}
                  </div>
                  <div className="text-xs text-gray-500">{fullDateTime(e.createdAt)}{e.note && ` - ${e.note}`}</div>
                </div>
                <div className={cn('amount font-bold', e.type === 'CREDIT' ? 'text-error-700' : 'text-success-700')}>
                  {e.type === 'CREDIT' ? '+' : '-'}{inr(e.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showBulk && (
        <Modal onClose={() => setShowBulk(false)} title="Bulk Payment - Settle all">
          <div className="space-y-3">
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 text-sm text-brand-900">
              <strong>{p.name}</strong> ko aaj {inr(p.balance)} chahiye. Ek baar mein kitna mila?
            </div>
            <Field label="Amount">
              <Input type="number" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} placeholder={String(p.balance)} autoFocus />
            </Field>
            <Field label="Method">
              <div className="grid grid-cols-3 gap-2">
                {(['CASH', 'UPI', 'CARD'] as const).map((m) => (
                  <button key={m} onClick={() => setBulkMethod(m)}
                    className={cn('p-2 rounded-lg border-2 text-sm font-semibold',
                      bulkMethod === m ? 'border-brand-600 bg-brand-50' : 'border-gray-200')}>
                    {m}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Note (optional)">
              <Input value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="Settled all pending" />
            </Field>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" onClick={() => setShowBulk(false)}>Cancel</Button>
              <Button onClick={() => bulk.mutate()} loading={bulk.isPending} disabled={!bulkAmount}>
                <Zap className="size-4" /> Settle
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
