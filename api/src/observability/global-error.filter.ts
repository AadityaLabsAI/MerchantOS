// Global error → JSON. Handles HttpException, ZodError, pg errors.
import { Catch, ExceptionFilter, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { ZodError } from 'zod';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  private logger = new Logger('error');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let status = 500;
    let message: string = 'Internal server error';
    let code: string = 'INTERNAL';
    let fields: Record<string, string> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      if (typeof r === 'string') { message = r; }
      else if (typeof r === 'object' && r !== null) {
        const o = r as { message?: string | string[]; code?: string };
        if (o.code) code = o.code;
        else code = `HTTP_${status}`;
        message = Array.isArray(o.message) ? o.message.join('; ') : o.message ?? message;
      } else {
        code = `HTTP_${status}`;
      }
    } else if (exception instanceof ZodError) {
      status = 400;
      message = 'Validation failed';
      code = 'VALIDATION_ERROR';
      fields = {};
      for (const i of exception.issues) fields[i.path.join('.')] = i.message;
    } else if (exception instanceof Error) {
      const msg = exception.message;
      // Use PG error codes for reliable detection.
      const pgCode = (exception as any).code;
      if (pgCode === '23505') { status = 409; code = 'DUPLICATE'; message = 'Resource already exists'; }
      else if (pgCode === '23503') { status = 409; code = 'FK_VIOLATION'; message = 'Referenced resource does not exist'; }
      else if (pgCode === '23502') { status = 400; code = 'NULL_VIOLATION'; message = 'Required field missing'; }
      else { this.logger.error(`${req.method} ${req.url} -> ${msg}
${exception.stack}`); message = msg; }
    }

    const body = { error: { code, message, fields, requestId: req.id ?? null } };
    if (typeof res.code === 'function' && typeof res.send === 'function') res.code(status).send(body);
    else if (typeof res.status === 'function' && typeof res.json === 'function') res.status(status).json(body);
    else res.send(JSON.stringify(body));
  }
}
