import { useEffect, useState } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, BadgePercent, Wallet } from 'lucide-react';
import { Button, Input } from '@/lib/ui';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function LoginPage() {
  const nav = useNavigate();
  const router = useRouter();
  const { status, load } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.loadTokensFromStorage();
    if (api.getRefreshToken()) {
      load().then(() => {
        if (useAuth.getState().status === 'authed') nav({ to: '/app/dashboard' });
      });
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      if (mode === 'login') await api.login(email, password);
      else await api.register(email, password);
      await load();
      await router.invalidate();
      nav({ to: '/app/dashboard' });
    } catch (e: any) {
      setErr(e?.message || 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* LEFT: brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white overflow-hidden">
        <div className="absolute -top-40 -right-40 size-[500px] rounded-full bg-accent-500/20 blur-3xl" />
        <div className="absolute bottom-0 -left-20 size-80 rounded-full bg-success-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="size-10 rounded-xl bg-white/15 backdrop-blur grid place-items-center font-bold text-xl">M</div>
            <div>
              <div className="font-bold text-xl leading-tight">MerchantOS</div>
              <div className="text-xs text-white/60">0% Commission. Forever.</div>
            </div>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">Bharat ka hisaab,<br/>digital.</h1>
          <p className="text-white/70 text-lg max-w-md mb-12">
            POS, khata, payments, inventory — one self-hosted app. Your shop, your data, your money.
          </p>
          <div className="grid grid-cols-1 gap-3 max-w-md">
            {[
              { icon: <BadgePercent className="size-5" />, t: 'Zero commission on UPI payments', s: 'PhonePe, Paytm, BharatPe charge. We don\'t.' },
              { icon: <Wallet className="size-5" />, t: 'Direct bank settlement', s: 'No T+1 wallet lockup, no hidden fees.' },
              { icon: <ShieldCheck className="size-5" />, t: 'Your data, your server', s: 'Self-hosted. Open source. MIT licensed.' },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/8 backdrop-blur rounded-xl p-4 border border-white/10">
                <div className="text-accent-300 shrink-0 mt-0.5">{f.icon}</div>
                <div>
                  <div className="font-semibold">{f.t}</div>
                  <div className="text-sm text-white/60">{f.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center justify-between text-xs text-white/50">
          <span>Powered by UPI • NPCI compliant</span>
          <span>Made in India 🇮🇳</span>
        </div>
      </div>

      {/* RIGHT: form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="size-9 rounded-xl bg-brand-600 grid place-items-center text-white font-bold">M</div>
            <span className="font-bold text-lg">MerchantOS</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create your shop'}
          </h2>
          <p className="text-gray-500 mb-8 text-sm">
            {mode === 'login' ? 'Sign in to your merchant account' : 'First user becomes the owner. Subsequent users are added by the owner.'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            <Input type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email" placeholder="you@shop.in" leftAddon={<Mail className="size-4" />} />

            <Input type={showPwd ? 'text' : 'password'} label="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              leftAddon={<Lock className="size-4" />}
              rightAddon={
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="hover:text-gray-700">
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />

            {err && <div className="text-error-600 text-sm bg-error-50 border border-error-100 rounded-lg p-3">{err}</div>}

            <Button type="submit" variant="primary" size="lg" loading={loading} full>
              {mode === 'login' ? 'Sign in' : 'Create shop'}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="text-center mt-6">
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(null); }}
              className="text-sm text-brand-600 font-semibold hover:text-brand-700">
              {mode === 'login' ? 'New here? Create your shop →' : 'Already have an account? Sign in →'}
            </button>
          </div>

          <div className="mt-10 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
              <ShieldCheck className="size-3.5" />
              <span>JWT secured • OWASP-hardened • MIT licensed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
