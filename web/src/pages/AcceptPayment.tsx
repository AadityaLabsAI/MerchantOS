import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { QrCode, Copy, Share2, Link as LinkIcon, Volume2, ArrowLeft, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, CardBody, Input, Badge } from '@/lib/ui';
import { inr } from '@/lib/utils';

type Session = { token: string; amount: number; upiLink: string; qrPayload: string; expiresAt: string };

export function AcceptPaymentPage() {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);

  const create = useMutation({
    mutationFn: () => api.post<Session>('/api/payment/sessions', {
      amount: parseFloat(amount) || 0,
      note: note || undefined,
    }),
    onSuccess: (data) => setSession(data),
  });

  function speak(text: string) {
    if (!('speechSynthesis' in window)) return;
    setPlaying(true);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-IN';
    u.rate = 1;
    u.onend = () => setPlaying(false);
    speechSynthesis.speak(u);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    if (!session) return;
    const msg = encodeURIComponent(`Pay ₹${amount} to MerchantOS shop: ${session.upiLink}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-2xl mx-auto">
      <button onClick={() => { setSession(null); setAmount(''); setNote(''); }}
        className="text-sm text-gray-500 hover:text-gray-700 mb-3 inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Back
      </button>

      {!session ? (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Accept a payment</h1>
            <p className="text-gray-500 text-sm mt-1">भुगतान लें — enter the amount and share the QR</p>
          </div>
          <Card>
            <CardBody className="space-y-5">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    autoFocus
                    className="w-full text-5xl font-bold pl-12 pr-4 h-20 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-brand-500 focus:bg-white outline-none transition-all amount"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  {[100, 200, 500, 1000, 2000].map(v => (
                    <button key={v} onClick={() => setAmount(String(v))}
                      className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-brand-50 hover:text-brand-700 text-sm font-medium text-gray-700 transition-colors">
                      ₹{v}
                    </button>
                  ))}
                </div>
              </div>

              <Input label="Note (optional)" placeholder="e.g. 5 kg atta" value={note}
                onChange={(e) => setNote(e.target.value)} />

              <Button size="xl" full onClick={() => create.mutate()} loading={create.isPending}
                disabled={!amount || parseFloat(amount) <= 0}>
                Generate QR / payment link
              </Button>
              {create.error && <div className="text-error-600 text-sm">{(create.error as any)?.message}</div>}
            </CardBody>
          </Card>
        </div>
      ) : (
        <div>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 text-white p-6 text-center">
              <p className="text-sm text-white/70 mb-1">Customer pays</p>
              <div className="amount text-5xl font-bold mb-1">{inr(session.amount)}</div>
              {note && <div className="text-sm text-white/80">{note}</div>}
            </div>

            <CardBody className="flex flex-col items-center">
              {/* QR code */}
              <div className="bg-white p-5 rounded-2xl border-4 border-brand-50 shadow-card">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(session.upiLink)}&color=1E3A8A`}
                  alt="Payment QR"
                  className="size-60"
                />
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center max-w-xs">
                Scan & pay with any UPI app — PhonePe, Paytm, Google Pay, BHIM
              </p>

              <div className="flex items-center gap-2 mt-4">
                <Badge tone="brand">Powered by UPI</Badge>
                <Badge tone="success">NPCI compliant</Badge>
              </div>

              <div className="w-full mt-6 space-y-2">
                <button onClick={() => copy(session.upiLink)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  <span className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                    <LinkIcon className="size-4 shrink-0" />
                    <span className="truncate font-mono text-xs">{session.upiLink}</span>
                  </span>
                  {copied ? <Check className="size-4 text-success-600" /> : <Copy className="size-4 text-gray-400" />}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="primary" onClick={shareWhatsApp}>
                    <Share2 className="size-4" /> WhatsApp
                  </Button>
                  <Button variant="secondary" onClick={() => speak(`Payment request for rupees ${session.amount}`)} loading={playing}>
                    <Volume2 className="size-4" /> Voice alert
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="text-center mt-4">
            <button onClick={() => setSession(null)} className="text-sm text-gray-500 hover:text-gray-700">
              ← New amount
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
