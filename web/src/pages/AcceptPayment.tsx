import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { QrCode, Copy, Share2, Link as LinkIcon, Volume2, ArrowLeft, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, CardBody, Input, Badge } from '@/lib/ui';

type Money = { currency: string; minor: string };
type Session = {
  id: string;
  paymentToken: string;
  expiresAt: string;
  amount: Money;
};
type PublicSession = { amount: Money; state: string; expiresAt: string; upiUri?: string | null };

function parseInrMinor(input: string): string | null {
  const value = input.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  try {
    const rupees = BigInt(match[1]);
    const paise = BigInt((match[2] ?? '').padEnd(2, '0') || '0');
    const minor = rupees * 100n + paise;
    return minor > 0n ? minor.toString() : null;
  } catch {
    return null;
  }
}

function formatInr(minorText: string): string {
  const minor = BigInt(minorText);
  return '₹' + (minor / 100n).toLocaleString('en-IN') + '.' + (minor % 100n).toString().padStart(2, '0');
}

function paymentPageUrl(token: string): string {
  return new URL('/pay/' + encodeURIComponent(token), window.location.origin).toString();
}

export function AcceptPaymentPage() {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [copyTarget, setCopyTarget] = useState<'id' | 'link' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paymentState, setPaymentState] = useState('CREATED');

  const minorAmount = useMemo(() => parseInrMinor(amount), [amount]);
  const create = useMutation({
    mutationFn: () => {
      if (!minorAmount) throw new Error('Enter a valid amount greater than ₹0.00.');
      return api.post<Session>('/api/payments/sessions', {
        amount: { currency: 'INR', minor: minorAmount },
        description: note.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      setSession(data);
      setPaymentState('CREATED');
    },
  });

  useEffect(() => {
    if (!session) return;
    let stopped = false;
    const refresh = async () => {
      try {
        const response = await fetch('/pay/' + encodeURIComponent(session.paymentToken), {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = await response.json() as PublicSession;
        if (!stopped) setPaymentState(data.state);
      } catch {
        // A transient polling failure must not change or imply payment status.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [session]);

  async function copyText(text: string, target: 'id' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setCopyTarget(target);
      window.setTimeout(() => setCopyTarget(null), 1800);
    } catch {
      // Clipboard access can be blocked in non-secure origins.
      window.prompt('Copy this text', text);
    }
  }

  function speak(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setPlaying(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 1;
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  function shareWhatsApp() {
    if (!session) return;
    const link = paymentPageUrl(session.paymentToken);
    const message = encodeURIComponent(`Please pay ${formatInr(session.amount.minor)} using this MerchantOS UPI payment page: ${link}`);
    window.open('https://wa.me/?text=' + message, '_blank', 'noopener,noreferrer');
  }

  const link = session ? paymentPageUrl(session.paymentToken) : '';
  const verified = paymentState === 'VERIFIED';
  const active = ['CREATED', 'PENDING', 'PROCESSING'].includes(paymentState);

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-2xl mx-auto">
      <button onClick={() => { setSession(null); setAmount(''); setNote(''); create.reset(); }}
        className="text-sm text-gray-500 hover:text-gray-700 mb-3 inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Back
      </button>

      {!session ? (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Accept a UPI payment</h1>
            <p className="text-gray-500 text-sm mt-1">Enter the total and generate a QR code for your configured UPI ID.</p>
          </div>
          <Card>
            <CardBody className="space-y-5">
              <div>
                <label htmlFor="payment-amount" className="text-sm font-medium text-gray-700 mb-1.5 block">Amount (INR)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">₹</span>
                  <input
                    id="payment-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                    aria-describedby="payment-amount-help"
                    className="w-full text-5xl font-bold pl-12 pr-4 h-20 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-brand-500 focus:bg-white outline-none transition-all amount"
                  />
                </div>
                <div id="payment-amount-help" className="text-xs text-gray-500 mt-2">Up to two decimal places. The amount is stored as integer paise.</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[100, 200, 500, 1000, 2000].map(v => (
                    <button key={v} type="button" onClick={() => setAmount(String(v))}
                      className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-sm font-medium text-gray-700 transition-colors">
                      ₹{v}
                    </button>
                  ))}
                </div>
                {amount && !minorAmount && <div role="alert" className="text-sm text-red-600 mt-2">Enter a valid amount greater than ₹0.00, using no more than two decimal places.</div>}
              </div>

              <Input label="Payment note (optional)" placeholder="e.g. Invoice 1042" value={note}
                onChange={(e) => setNote(e.target.value)} />

              <Button size="xl" full onClick={() => create.mutate()} loading={create.isPending}
                disabled={!minorAmount || create.isPending}>
                <QrCode className="size-5" /> Generate UPI QR / link
              </Button>
              {create.error && <div role="alert" className="text-error-600 text-sm">{create.error.message}</div>}
              <p className="text-xs text-gray-500">Configure the store's UPI ID first in Settings. This QR opens the customer's UPI app; it does not itself verify that money arrived.</p>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 text-white p-6 text-center">
              <p className="text-sm text-white/70 mb-1">Customer pays</p>
              <div className="amount text-5xl font-bold mb-1">{formatInr(session.amount.minor)}</div>
              {note.trim() && <div className="text-sm text-white/80">{note.trim()}</div>}
            </div>

            <CardBody className="flex flex-col items-center">
              <div className="bg-white p-4 rounded-2xl border-4 border-brand-50 shadow-card">
                <img
                  src={'/api/payments/qr/' + encodeURIComponent(session.paymentToken)}
                  alt="UPI payment QR code"
                  className="size-60"
                  width={240}
                  height={240}
                />
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center max-w-xs">
                Scan with a UPI app and check the recipient name and amount before approving.
              </p>

              <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                <Badge tone="brand">UPI intent</Badge>
                <Badge tone={verified ? 'success' : 'warning'}>{verified ? 'Verified' : active ? 'Awaiting verification' : paymentState}</Badge>
              </div>

              <div className="w-full mt-6 space-y-2">
                <button type="button" onClick={() => copyText(link, 'link')}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  <span className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                    <LinkIcon className="size-4 shrink-0" />
                    <span className="truncate font-mono text-xs">{link}</span>
                  </span>
                  {copyTarget === 'link' ? <Check className="size-4 text-success-600" /> : <Copy className="size-4 text-gray-400" />}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="primary" onClick={shareWhatsApp}>
                    <Share2 className="size-4" /> Share link
                  </Button>
                  <Button variant="secondary" onClick={() => speak(`Payment request for ${formatInr(session.amount.minor)}`)} loading={playing}>
                    <Volume2 className="size-4" /> Voice alert
                  </Button>
                </div>
                <Button variant="secondary" full onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}>
                  <ExternalLink className="size-4" /> Open customer payment page
                </Button>
                <Button variant="secondary" full onClick={() => { setSession(null); setAmount(''); setNote(''); create.reset(); }}>
                  <RefreshCw className="size-4" /> New payment request
                </Button>
              </div>
            </CardBody>
          </Card>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mt-4 text-sm text-amber-900">
            <strong>Important:</strong> Opening or scanning this QR does not confirm payment. The status changes to verified only after a trusted payment-provider event is received. For direct UPI transfers without a provider integration, reconcile the credit in your bank/UPI app before recording it as received.
          </div>
        </div>
      )}
    </div>
  );
}
