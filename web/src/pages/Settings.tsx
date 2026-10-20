import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@tanstack/react-router';
import { User, Globe, LogOut, Save, Store, Loader2, WalletCards, ShieldCheck } from 'lucide-react';
import { Card, CardBody, Button, Avatar, Badge, Input, Textarea, Field } from '@/lib/ui';
import { useI18n, LOCALES, t, greeting } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';

type PaymentSettings = {
  configured: boolean;
  upiVpa: string;
  payeeName: string;
  phone: string | null;
};

const EMPTY_PAYMENT_SETTINGS: PaymentSettings = {
  configured: false,
  upiVpa: '',
  payeeName: '',
  phone: '',
};

export function SettingsPage() {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const { locale, setLocale } = useI18n();
  const [payment, setPayment] = useState<PaymentSettings>(EMPTY_PAYMENT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const canEdit = me?.permissions?.includes('settings:edit') ?? me?.role === 'OWNER';

  useEffect(() => {
    let mounted = true;
    api.get<PaymentSettings>('/api/payments/settings')
      .then((data) => { if (mounted) setPayment({ ...EMPTY_PAYMENT_SETTINGS, ...data }); })
      .catch((error) => {
        if (!mounted) return;
        setLoadError((error as Error)?.message || 'Could not load payment settings.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (!me) return null;

  async function savePaymentSettings() {
    setSaving(true);
    setLoadError('');
    try {
      const updated = await api.put<PaymentSettings>('/api/payments/settings', {
        upiVpa: payment.upiVpa.trim(),
        payeeName: payment.payeeName.trim(),
        phone: payment.phone?.trim() || null,
      });
      setPayment(updated);
      toast.success('UPI receiving details saved.');
    } catch (error) {
      const message = (error as Error)?.message || 'Could not save UPI receiving details.';
      setLoadError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await logout();
    nav({ to: '/login' });
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">{greeting(locale)}, {me.name || me.email}</p>
      </div>

      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar name={me.name || me.email} size={56} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-900">{me.name || me.email}</div>
            <div className="text-sm text-gray-500">{me.email}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge tone="brand">{me.role}</Badge>
              <Badge tone="success">Signed in</Badge>
            </div>
          </div>
          <Button variant="secondary" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center">
              <Globe className="size-5" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{t('settings.language', locale)}</div>
              <div className="text-xs text-gray-500">Choose the language shown in MerchantOS</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LOCALES.map((l) => (
              <button key={l.code} type="button"
                onClick={() => { setLocale(l.code); toast.success(t('toast.saved', locale)); }}
                className={`p-3 rounded-xl border-2 transition ${locale === l.code ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="text-sm font-bold text-gray-900 mt-1">{l.label}</div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center">
              <WalletCards className="size-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">UPI receiving details</div>
              <div className="text-xs text-gray-500">Customers can pay directly to the UPI ID you configure for this store.</div>
            </div>
            {payment.configured
              ? <Badge tone="success">Configured</Badge>
              : <Badge tone="warning">Not configured</Badge>}
          </div>

          {loading ? (
            <div className="py-6 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading payment settings…</div>
          ) : (
            <>
              <Field label="UPI ID / Virtual Payment Address (VPA)">
                <Input value={payment.upiVpa} onChange={(e) => setPayment({ ...payment, upiVpa: e.target.value })}
                  placeholder="yourname@bankhandle" disabled={!canEdit} autoComplete="off" />
              </Field>
              <Field label="Payee name (as shown in your UPI app)">
                <Input value={payment.payeeName} onChange={(e) => setPayment({ ...payment, payeeName: e.target.value })}
                  placeholder="Your shop name" disabled={!canEdit} />
              </Field>
              <Field label="UPI contact number (optional; does not replace your UPI ID)">
                <Input value={payment.phone || ''} onChange={(e) => setPayment({ ...payment, phone: e.target.value })}
                  placeholder="+91…" inputMode="tel" disabled={!canEdit} />
              </Field>

              {canEdit ? (
                <Button onClick={savePaymentSettings} disabled={saving || !payment.upiVpa.trim() || !payment.payeeName.trim()} full>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save UPI settings
                </Button>
              ) : (
                <div className="text-sm text-gray-500">Only users with the store settings permission can change the receiving account.</div>
              )}

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 flex gap-2">
                <ShieldCheck className="size-5 shrink-0" />
                <div>
                  MerchantOS generates the UPI QR locally. A QR or UPI-app redirect is not proof that a payment settled. Check your bank/UPI app and use a trusted provider integration for automatic settlement verification.
                </div>
              </div>
            </>
          )}
          {loadError && <div role="alert" className="text-sm text-red-600">{loadError}</div>}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gray-100 text-gray-700 grid place-items-center">
            <User className="size-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900">Merchant account</div>
            <div className="text-xs text-gray-500">Your account and role are managed by the merchant owner.</div>
          </div>
          <Badge tone="brand">{me.role}</Badge>
        </CardBody>
      </Card>
    </div>
  );
}
