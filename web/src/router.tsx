import { createRouter, createRootRoute, createRoute, Outlet, redirect } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { LoginPage } from '@/pages/Login';
import { AppShell } from '@/pages/AppShell';
import { DashboardPage } from '@/pages/Dashboard';
import { AcceptPaymentPage } from '@/pages/AcceptPayment';
import { POSPage } from '@/pages/POS';
import { TransactionsPage } from '@/pages/Transactions';
import { KhataPage } from '@/pages/Khata';
import { PartyDetailPage } from '@/pages/PartyDetail';
import { ReportsPage } from '@/pages/Reports';
import { ProductsPage } from '@/pages/Products';
import { SuppliersPage } from '@/pages/Suppliers';
import { BillsPage } from '@/pages/Bills';
import { ExpensesPage } from '@/pages/Expenses';
import { ShiftsPage } from '@/pages/Shifts';
import { SettingsPage } from '@/pages/Settings';
import { CustomerViewPage } from '@/pages/CustomerView';
import { ShiftOpenGate } from '@/pages/ShiftOpenGate';

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: '/app/dashboard' }); },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const appLayout = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  component: AppShell,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/dashboard',
  component: () => <ShiftOpenGate><DashboardPage /></ShiftOpenGate>,
});

const acceptRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/accept',
  component: () => <ShiftOpenGate><AcceptPaymentPage /></ShiftOpenGate>,
});

const posRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/pos',
  component: () => <ShiftOpenGate><POSPage /></ShiftOpenGate>,
});

const transactionsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/transactions',
  component: () => <ShiftOpenGate><TransactionsPage /></ShiftOpenGate>,
});

const khataRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/khata',
  component: () => <ShiftOpenGate><KhataPage /></ShiftOpenGate>,
});

const partyDetailRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/khata/$partyId',
  component: () => <ShiftOpenGate><PartyDetailPage /></ShiftOpenGate>,
});

const productsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/products',
  component: () => <ShiftOpenGate><ProductsPage /></ShiftOpenGate>,
});

const suppliersRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/suppliers',
  component: () => <ShiftOpenGate><SuppliersPage /></ShiftOpenGate>,
});

const billsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/bills',
  component: () => <ShiftOpenGate><BillsPage /></ShiftOpenGate>,
});

const expensesRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/expenses',
  component: () => <ShiftOpenGate><ExpensesPage /></ShiftOpenGate>,
});

const shiftsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/shifts',
  component: () => <ShiftOpenGate><ShiftsPage /></ShiftOpenGate>,
});

const reportsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/reports',
  component: () => <ShiftOpenGate><ReportsPage /></ShiftOpenGate>,
});

const settingsRoute = createRoute({
  getParentRoute: () => appLayout,
  path: '/settings',
  component: () => <ShiftOpenGate><SettingsPage /></ShiftOpenGate>,
});

const customerViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pay/cst_$id',
  component: CustomerViewPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  customerViewRoute,
  appLayout.addChildren([
    dashboardRoute, acceptRoute, posRoute, transactionsRoute, khataRoute,
    partyDetailRoute, productsRoute, suppliersRoute, billsRoute,
    expensesRoute, shiftsRoute, reportsRoute, settingsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}
