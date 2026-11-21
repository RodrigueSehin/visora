import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { AppError, CurrentUser, Public, ZodPipe, type AuthUser } from '../common/http';
import { AuthService, REFRESH_TTL_MS, type Tokens } from './auth.service';

export const REFRESH_COOKIE = 'visora_rt';

const signupSchema = z.object({
  email: z.string().trim().email('E-mail invalide').max(254),
  password: z.string().min(10, 'Au moins 10 caractères').max(200),
  name: z.string().trim().min(1, 'Nom requis').max(80),
  organizationName: z.string().trim().max(80).optional(),
});
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(200) });
const meSchema = z.object({ name: z.string().trim().min(1).max(80).optional() });

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('signup')
  async signup(@Body(new ZodPipe(signupSchema)) body: z.infer<typeof signupSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { tokens } = await this.auth.signup(body, req.headers['user-agent']);
    return this.respond(res, tokens);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { tokens } = await this.auth.login(body.email, body.password, req.headers['user-agent']);
    return this.respond(res, tokens);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.checkOrigin(req);
    try {
      return this.respond(res, await this.auth.refresh(req.cookies?.[REFRESH_COOKIE], req.headers['user-agent']));
    } catch (e) {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      throw e;
    }
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.checkOrigin(req);
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.auth.me(u.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() u: AuthUser, @Body(new ZodPipe(meSchema)) body: z.infer<typeof meSchema>) {
    return this.auth.updateMe(u.id, body);
  }

  private respond(res: Response, t: Tokens) {
    // Refresh token: httpOnly + SameSite=Strict + scoped to /api/auth (never readable by JS).
    res.cookie(REFRESH_COOKIE, t.refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config().COOKIE_SECURE,
      path: '/api/auth',
      maxAge: REFRESH_TTL_MS,
    });
    return { accessToken: t.accessToken, expiresIn: t.expiresIn };
  }

  /** Cookie-authenticated endpoints reject cross-site browser requests (CSRF defence in depth). */
  private checkOrigin(req: Request) {
    const origin = req.headers.origin;
    if (!origin) return;
    const allowed = config().CORS_ORIGIN.split(',').map((s) => s.trim());
    const self = `${req.protocol}://${req.headers.host}`;
    if (origin !== self && !allowed.includes(origin)) throw new AppError(HttpStatus.FORBIDDEN, 'bad_origin', 'Origine non autorisée.');
  }
}
