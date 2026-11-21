import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  createParamDecorator,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  PipeTransform,
  SetMetadata,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ZodSchema } from 'zod';

/** Validates and coerces a request part with a Zod schema (400 with field details on failure). */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}
  transform(value: unknown): T {
    const r = this.schema.safeParse(value);
    if (!r.success)
      throw new BadRequestException({
        code: 'validation_error',
        message: 'Données invalides.',
        details: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    return r.data;
  }
}

/** Domain errors with a stable machine-readable code. */
export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, extra?: Record<string, unknown>) {
    super({ code, message, ...extra }, status);
  }
}

export const notFound = (what = 'Ressource') => new AppError(HttpStatus.NOT_FOUND, 'not_found', `${what} introuvable.`);
export const forbidden = (msg = 'Action non autorisée pour votre rôle.') => new AppError(HttpStatus.FORBIDDEN, 'forbidden', msg);

/** Every error leaves the API as { error: { code, message, details? } }. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly log = new Logger('HTTP');
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request>();
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const body = err.getResponse();
      const payload =
        typeof body === 'object' && body && 'code' in body
          ? body
          : { code: status === 429 ? 'rate_limited' : HttpStatus[status]?.toLowerCase() ?? 'error', message: typeof body === 'string' ? body : (body as { message?: string }).message ?? err.message };
      if (status === 429) (payload as { message: string }).message = 'Trop de requêtes, réessayez dans un instant.';
      res.status(status).json({ error: payload });
      return;
    }
    // Unexpected: log server-side, never leak internals to the client.
    this.log.error(`${req.method} ${req.url}`, err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: { code: 'internal_error', message: 'Erreur interne du serveur.' } });
  }
}

export type AuthUser = { id: string };
export const IS_PUBLIC = 'isPublic';
/** Marks a route as accessible without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
