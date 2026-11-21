import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppError, IS_PUBLIC } from './http';

/** Global guard: every route requires a valid Bearer access token unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new AppError(HttpStatus.UNAUTHORIZED, 'unauthenticated', 'Authentification requise.');
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; typ: string }>(token);
      if (payload.typ !== 'access') throw new Error('wrong token type');
      req.user = { id: payload.sub };
      return true;
    } catch {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'token_invalid', 'Session expirée, reconnectez-vous.');
    }
  }
}
