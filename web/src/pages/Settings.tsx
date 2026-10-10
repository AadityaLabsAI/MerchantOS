import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNavigate } from '@tanstack/react-router';
import { User, Globe, LogOut, Save, Store, Download, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardBody, Button, Avatar, Badge, Input, Textarea, Field, Modal } from '@/lib/ui';
import { useI18n, LOCALES, t, greeting, type Locale } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';

export function SettingsPage() {
  const { me, logout } = useAuth();
  const nav = useNavigate();
  const { locale, setLocale } = useI18n();
  const [shop, setShop] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [restoreText, setRestoreText] = useState('');

  useEffect(() => {
    api('/api/shop/settings').then(setShop).catch(() => toast.error(t('toast.error', locale))).finally(() => setLoading(false));
  }, []);

  if (!me) return null;
  if (loading || !shop) {
    return <div className="p-8 text-center text-gray-500">{t('common.loading', locale)}</div>;
  }

  async function saveShop() {
    setSaving(true);
    try {
      const updated = await api('/api/shop/settings', { method: 'PUT', body: shop });
      setShop(updated);
      toast.success(t('toast.saved', locale));
    } catch {
      toast.error(t('toast.error', locale));
    } finally {
      setSaving(false);
    }
  }

  async function doBackup() {
    try {
      const data = await api('/api/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merchantos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('toast.saved', locale));
    } catch {
      toast.error(t('toast.error', locale));
    }
  }

  async function doRestore() {
    try {
      const data = JSON.parse(restoreText);
      await api('/api/restore', { method: 'POST', body: data });
      toast.success(t('toast.synced', locale));
      setShowBackupModal(false);
      setTimeout(() => location.reload(), 500);
    } catch {
      toast.error(t('toast.error', locale));
    }
  }

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title', locale)}</h1>
        <p className="text-sm text-gray-500 mt-1">{greeting(locale)}, {me.name || me.email}</p>
      </div>

      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar name={me.name || me.email} size={56} />
          <div className="flex-1">
            <div className="font-bold text-gray-900">{me.name || me.email}</div>
            <div className="text-sm text-gray-500">{me.email}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone="brand">{me.role}</Badge>
            </div>
          </div>
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
              <div className="text-xs text-gray-500">App ki bhasha</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {LOCALES.map((l) => (
              <button key={l.code}
                onClick={() => { setLocale(l.code); toast.success(t('toast.saved', locale)); }}
                className={`p-3 rounded-xl border-2 transition ${locale === l.code ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="text-sm font-bold text-gray-900 mt-1">{l.label}</div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center">
              <Store className="size-5" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Shop Details</div>
              <div className="text-xs text-gray-500">Bill pe dikhenge</div>
            </div>
          </div>
          <Field label={t('settings.shop_name', locale)}>
            <Input value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} />
          </Field>
          <Field label={t('settings.owner_name', locale)}>
            <Input value={shop.ownerName} onChange={(e) => setShop({ ...shop, ownerName: e.target.value })} />
          </Field>
          <Field label={t('settings.phone', locale)}>
            <Input value={shop.phone} onChange={(e) => setShop({ ...shop, phone: e.target.value })} />
          </Field>
          <Field label={t('settings.address', locale)}>
            <Textarea value={shop.address} onChange={(e) => setShop({ ...shop, address: e.target.value })} rows={2} />
          </Field>
          <Field label={t('settings.upi_id', locale)}>
            <Input value={shop.upiId} onChange={(e) => setShop({ ...shop, upiId: e.target.value })} placeholder="yourshop@upi" />
          </Field>
          <Field label={t('settings.gst', locale)}>
            <Input value={shop.gst} onChange={(e) => setShop({ ...shop, gst: e.target.value })} placeholder="27ABCDE1234F1Z5" />
          </Field>
          <Button onClick={saveShop} disabled={saving} full>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t('common.save', locale)}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-warning-50 text-warning-700 grid place-items-center">
              <Download className="size-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">{t('settings.backup', locale)}</div>
              <div className="text-xs text-gray-500">Apna data download / restore</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={doBackup}>
              <Download className="size-4" /> Backup
            </Button>
            <Button variant="secondary" onClick={() => setShowBackupModal(true)}>
              <Upload className="size-4" /> Restore
            </Button>
          </div>
        </CardBody>
      </Card>

      <Button variant="secondary" size="lg" full onClick={() => { logout(); nav({ to: '/login' }); }}>
        <LogOut className="size-4" /> {t('auth.signout', locale)}
      </Button>

      {showBackupModal && (
        <Modal onClose={() => setShowBackupModal(false)} title="Restore from backup">
          <div className="space-y-3">
            <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 text-sm text-warning-900 flex gap-2">
              <AlertTriangle className="size-5 shrink-0" />
              <div>Restoring will REPLACE all current data. Backup file paste karo.</div>
            </div>
            <Textarea rows={8} placeholder='{"version":1, ...}' value={restoreText} onChange={(e) => setRestoreText(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowBackupModal(false)}>Cancel</Button>
              <Button onClick={doRestore}>Restore</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
