// Top-level Nest module.
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER, Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { LandingController } from './landing/landing.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { HealthController } from './health/health.controller.js';
import { ProductController } from './product/product.controller.js';
import { BillController } from './bill/bill.controller.js';
import { CustomerController } from './customer/customer.controller.js';
import { ExpenseController } from './expense/expense.controller.js';
import { SupplierController } from './supplier/supplier.controller.js';
import { ShiftController } from './shift/shift.controller.js';
import { ReportsController } from './reports/reports.controller.js';
import { AuditController } from './audit/audit.controller.js';
import { PaymentModule } from './payment/payment.controller.js';
import { AssistantController } from './ai/assistant.controller.js';
import { AuthGuard } from './auth/auth.guard.js';
import { PermissionsGuard } from './rbac/rbac.guard.js';
import { GlobalErrorFilter } from './observability/global-error.filter.js';
import { RequestLoggerInterceptor } from './observability/request-logger.interceptor.js';
import { JwtService } from '@nestjs/jwt';
import { IdempotencyStoreInterceptor } from './middleware/idempotency.interceptor.js';

@Module({
  imports: [JwtModule.register({ global: true }), PaymentModule],
  controllers: [LandingController,
    AuthController,
    HealthController,
    ProductController,
    BillController,
    CustomerController,
    ExpenseController,
    SupplierController,
    ShiftController,
    AssistantController,
    ReportsController,
    AuditController,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestLoggerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyStoreInterceptor },
    { provide: APP_FILTER, useClass: GlobalErrorFilter },
  ],
})
export class AppModule {}

export function buildAuthGuard(reflector: Reflector, jwt: JwtService) { return new AuthGuard(reflector, jwt); }
export function buildPermissionsGuard(reflector: Reflector) { return new PermissionsGuard(reflector); }
