// Common Zod schemas shared across the API.
import { z } from 'zod';

export const MoneySchema = z.object({
  currency: z.string().length(3).regex(/^[A-Z]{3}$/i),
  minor: z.string().regex(/^\d+$/, 'minor must be a non-negative integer string'),
});
export type MoneyInput = z.infer<typeof MoneySchema>;

export const EmailSchema = z.string().email().max(254);
export const PasswordSchema = z.string().min(8).max(256);
export const NameSchema = z.string().min(1).max(200);
export const IdSchema = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/, 'invalid identifier');
// Back-compat alias
export const UlidSchema = IdSchema;

export const LoginInput = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(256),
  storeId: UlidSchema.optional(),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const RegisterInput = z.object({
  merchantId: IdSchema,
  storeId: IdSchema,
  email: EmailSchema,
  password: PasswordSchema,
  name: NameSchema,
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'STAFF']).default('CASHIER'),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const CreatePaymentSessionInput = z.object({
  amount: MoneySchema,
  deviceId: z.string().min(1).max(64).optional(),
  billId: IdSchema.optional(),
  customerId: IdSchema.optional(),
  description: z.string().max(200).optional(),
  ttlSeconds: z.number().int().positive().max(3600).default(600),
});
export type CreatePaymentSessionInput = z.infer<typeof CreatePaymentSessionInput>;

export const CreateBillInput = z.object({
  storeId: IdSchema,
  customerId: IdSchema.optional(),
  lines: z.array(z.object({
    productId: IdSchema,
    quantity: z.number().int().positive(),
    overridePrice: MoneySchema.optional(),
  })).min(1),
  notes: z.string().max(500).optional(),
  taxBps: z.number().int().min(0).max(10000).default(0),
  currency: z.string().length(3).default('INR'),
});
export type CreateBillInput = z.infer<typeof CreateBillInput>;

export const CreateExpenseInput = z.object({
  storeId: IdSchema,
  category: z.enum(['RENT', 'UTILITIES', 'SALARY', 'INVENTORY', 'MAINTENANCE', 'MARKETING', 'TRAVEL', 'MISC']),
  amount: MoneySchema,
  description: z.string().min(1).max(200),
  vendor: z.string().max(200).optional(),
});
export type CreateExpenseInput = z.infer<typeof CreateExpenseInput>;

export const CreateCustomerInput = z.object({
  storeId: IdSchema,
  name: NameSchema,
  phone: z.string().max(20).optional(),
  email: EmailSchema.optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerInput>;

// Money that may be negative (for ledger entries).
export const SignedMoneySchema = z.object({
  currency: z.string().length(3).regex(/^[A-Z]{3}$/i),
  minor: z.string().regex(/^-?\d+$/, 'minor must be a signed integer string'),
});
