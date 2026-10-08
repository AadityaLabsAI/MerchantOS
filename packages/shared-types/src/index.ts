// Shared domain types & role permission matrix.
// Single source of truth, used by API and packages.

export type Role = 'OWNER' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT' | 'STAFF';

export const ROLES: readonly Role[] = ['OWNER', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'STAFF'] as const;

export const PERMISSIONS = {
  BILLING_CREATE: 'billing:create',
  BILLING_VIEW: 'billing:view',
  BILLING_CANCEL: 'billing:cancel',
  BILLING_REFUND: 'billing:refund',
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_EDIT: 'inventory:edit',
  EXPENSES_CREATE: 'expenses:create',
  EXPENSES_VIEW: 'expenses:view',
  PURCHASES_VIEW: 'purchases:view',
  PURCHASES_CREATE: 'purchases:create',
  PURCHASES_EDIT: 'purchases:edit',
  SUPPLIERS_VIEW: 'suppliers:view',
  SUPPLIERS_CREATE: 'suppliers:create',
  SUPPLIERS_EDIT: 'suppliers:edit',
  CUSTOMERS_VIEW: 'customers:view',
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_EDIT: 'customers:edit',
  KHATA_ADJUST: 'khata:adjust',
  REPORTS_VIEW: 'reports:view',
  SHIFTS_VIEW: 'shifts:view',
  SHIFTS_MANAGE: 'shifts:manage',
  SHIFTS_CLOSE: 'shifts:close',
  PAYMENTS_REFUND: 'payments:refund',
  PAYMENTS_VIEW: 'payments:view',
  STAFF_MANAGE: 'staff:manage',
  SETTINGS_EDIT: 'settings:edit',
  DEVICES_MANAGE: 'devices:manage',
  ASSISTANT_USE: 'assistant:use',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/** Hardcoded default role → permission matrix. The DB is the authoritative source. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: Object.values(PERMISSIONS),
  MANAGER: [
    PERMISSIONS.BILLING_CREATE, PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_CANCEL, PERMISSIONS.BILLING_REFUND,
    PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.EXPENSES_CREATE, PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.PURCHASES_VIEW, PERMISSIONS.PURCHASES_CREATE,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW, PERMISSIONS.CUSTOMERS_CREATE, PERMISSIONS.CUSTOMERS_EDIT,
    PERMISSIONS.KHATA_ADJUST,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SHIFTS_VIEW, PERMISSIONS.SHIFTS_MANAGE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.ASSISTANT_USE,
  ],
  CASHIER: [
    PERMISSIONS.BILLING_CREATE, PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW, PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.SHIFTS_VIEW, PERMISSIONS.SHIFTS_MANAGE,
    PERMISSIONS.PAYMENTS_VIEW,
  ],
  ACCOUNTANT: [
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.EXPENSES_CREATE, PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.PURCHASES_VIEW, PERMISSIONS.PURCHASES_CREATE, PERMISSIONS.PURCHASES_EDIT,
    PERMISSIONS.SUPPLIERS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.SHIFTS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
  ],
  STAFF: [
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.SHIFTS_VIEW,
  ],
};

export type PaymentSessionState =
  | 'CREATED' | 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'VERIFIED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export type BillState =
  | 'DRAFT' | 'FINALIZED' | 'REFUNDED' | 'CANCELLED' | 'PAYMENT_PENDING' | 'PAYMENT_FAILED';

export type MoneyJSON = { currency: string; minor: string };

export interface AuthContext {
  userId: string;
  merchantId: string;
  storeId: string | null;
  role: Role;
  permissions: Permission[];
}
