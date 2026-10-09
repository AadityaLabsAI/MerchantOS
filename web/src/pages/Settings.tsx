import { useAuth } from '@/lib/auth';
import { useNavigate } from '@tanstack/react-router';
import { User, Globe, Bell, ShieldCheck, LogOut } from 'lucide-react';
import { Card, CardBody, Button, Avatar, Badge } from '@/lib/ui';

export function SettingsPage() {
  const { me, logout } = useAuth();
  const nav = useNavigate();

  if (!me) return null;
  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar name={me.name || me.email} size={56} />
          <div className="flex-1">
            <div className="font-bold text-gray-900">{me.name || me.email}</div>
            <div className="text-sm text-gray-500">{me.email}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone="brand">{me.role}</Badge>
              <Badge tone="neutral">Store: {me.storeId?.slice(0, 8) || '—'}</Badge>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-2">
        {[
          { icon: <Globe className="size-5" />, label: 'Language', sub: 'English + Hindi side-by-side', cta: 'Change' },
          { icon: <Bell className="size-5" />, label: 'Notifications', sub: 'Soundbox, payment alerts, low-stock', cta: 'Manage' },
          { icon: <ShieldCheck className="size-5" />, label: 'Security', sub: 'PIN lock, biometric, session timeout', cta: 'Manage' },
        ].map((s, i) => (
          <Card key={i}>
            <CardBody className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center">{s.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{s.label}</div>
                <div className="text-xs text-gray-500">{s.sub}</div>
              </div>
              <Button variant="secondary" size="sm">{s.cta}</Button>
            </CardBody>
          </Card>
        ))}
      </div>

      <Button variant="secondary" size="lg" full onClick={() => { logout(); nav({ to: '/login' }); }}>
        <LogOut className="size-4" /> Sign out
      </Button>
    </div>
  );
}
