import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, QrCode, ShoppingCart, Receipt as ReceiptIcon, BookOpen,
  Package, Truck, FileText, CircleDollarSign, Clock, BarChart3, Settings, LogOut,
  Bell, Menu, X, Search,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/lib/ui';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/app/dashboard',    label: 'Dashboard',      hi: 'डैशबोर्ड',    icon: LayoutDashboard, accent: 'brand' },
  { to: '/app/accept',       label: 'Accept Payment', hi: 'भुगतान लें',   icon: QrCode,           accent: 'success' },
  { to: '/app/pos',          label: 'Quick Sale / POS', hi: 'बीफ़्री बिक्री', icon: ShoppingCart,   accent: 'accent' },
  { to: '/app/transactions', label: 'Transactions',   hi: 'लेन-देन',      icon: ReceiptIcon,      accent: 'brand' },
  { to: '/app/khata',        label: 'Khata',          hi: 'खाता',         icon: BookOpen,         accent: 'warning' },
  { to: '/app/products',     label: 'Products',       hi: 'सामान',         icon: Package,          accent: 'brand' },
  { to: '/app/suppliers',    label: 'Suppliers',      hi: 'सप्लायर',     icon: Truck,            accent: 'brand' },
  { to: '/app/bills',        label: 'Bills',          hi: 'बिल',          icon: FileText,         accent: 'brand' },
  { to: '/app/expenses',     label: 'Expenses',       hi: 'खर्च',          icon: CircleDollarSign, accent: 'error' },
  { to: '/app/shifts',       label: 'Shifts',         hi: 'शिफ़्ट',        icon: Clock,            accent: 'brand' },
  { to: '/app/reports',      label: 'Reports',        hi: 'रिपोर्ट',     icon: BarChart3,        accent: 'brand' },
];

const SETTINGS_NAV = { to: '/app/settings', label: 'Settings', hi: 'सेटिंग्स', icon: Settings, accent: 'brand' as const };

export function AppShell() {
  const { me, status, load, logout } = useAuth();
  const nav = useNavigate();
  const { location } = useRouterState();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === 'idle') load();
    if (status === 'guest') nav({ to: '/login' });
  }, [status]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (status !== 'authed' || !me) {
    return <div className="min-h-screen grid place-items-center text-gray-500">Loading…</div>;
  }

  function isActive(to: string) {
    return location.pathname === to || location.pathname.startsWith(to + '/');
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 flex-col">
        <div className="px-6 py-5 flex items-center gap-3 border-b border-gray-100">
          <div className="size-9 rounded-xl bg-brand-600 grid place-items-center text-white font-bold shadow-sm">M</div>
          <div className="flex-1">
            <div className="font-bold text-gray-900 leading-tight">MerchantOS</div>
            <div className="text-[11px] text-gray-500 leading-tight">0% Commission</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 overflow-y-auto no-scrollbar">
          <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold px-3 py-2">Main</div>
          {NAV.slice(0, 5).map(n => <NavLink key={n.to} item={n} active={isActive(n.to)} />)}
          <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold px-3 pt-5 pb-2">Manage</div>
          {NAV.slice(5).map(n => <NavLink key={n.to} item={n} active={isActive(n.to)} />)}
        </nav>

        <div className="px-3 py-3 border-t border-gray-100">
          <NavLink item={{ ...SETTINGS_NAV }} active={isActive(SETTINGS_NAV.to)} />
          <button onClick={() => { logout(); nav({ to: '/login' }); }}
            className="mt-2 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>

        <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-3 bg-gray-50/50">
          <Avatar name={me.name || me.email} size={36} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{me.name || me.email}</div>
            <div className="text-[11px] text-gray-500 truncate">{me.role}</div>
          </div>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <header className="lg:hidden fixed inset-x-0 top-0 z-30 bg-white border-b border-gray-100 h-14 flex items-center px-4 gap-3">
        <button onClick={() => setMobileOpen(true)} className="size-9 grid place-items-center -ml-2">
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-brand-600 grid place-items-center text-white text-xs font-bold">M</div>
          <span className="font-bold text-gray-900">MerchantOS</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button className="size-9 grid place-items-center"><Bell className="size-5 text-gray-600" /></button>
          <Avatar name={me.name || me.email} size={32} />
        </div>
      </header>

      {/* MOBILE DRAWER */}
      
        {mobileOpen && (
          <>
            <div onClick={() => setMobileOpen(false)} className="lg:hidden fixed inset-0 z-40 bg-black/40" />
            <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col">
              <div className="h-14 px-4 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-brand-600 grid place-items-center text-white font-bold">M</div>
                  <span className="font-bold">MerchantOS</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="size-9 grid place-items-center"><X className="size-5" /></button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 no-scrollbar">
                {NAV.map(n => <NavLink key={n.to} item={n} active={isActive(n.to)} />)}
                <div className="my-3 border-t border-gray-100" />
                <NavLink item={SETTINGS_NAV} active={isActive(SETTINGS_NAV.to)} />
              </nav>
            </aside>
          </>
        )}
      

      {/* MAIN AREA */}
      <div className="lg:pl-64 pt-14 lg:pt-0">
        <main className="min-h-screen">
          <Outlet />
        </main>
        {/* MOBILE BOTTOM NAV */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 grid grid-cols-5 gap-1 px-1 py-1 pb-[max(4px,env(safe-area-inset-bottom))]">
          {[NAV[0], NAV[1], NAV[2], NAV[3], NAV[4]].map(n => {
            const Icon = n.icon;
            return (
              <button key={n.to} onClick={() => nav({ to: n.to })}
                className={cn('flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium',
                  isActive(n.to) ? 'text-brand-700' : 'text-gray-500')}>
                <Icon className="size-5" />
                <span>{n.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function NavLink({ item, active }: { item: typeof NAV[number]; active: boolean }) {
  const nav = useNavigate();
  const Icon = item.icon;
  return (
    <button onClick={() => nav({ to: item.to })}
      className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-0.5',
        active ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50')}>
      <Icon className={cn('size-[18px]', active && 'text-brand-600')} />
      <span className="flex-1 text-left">{item.label}</span>
      {item.hi && <span className={cn('text-[11px] hidden xl:inline', active ? 'text-brand-500' : 'text-gray-400')}>{item.hi}</span>}
    </button>
  );
}
