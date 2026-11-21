import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AppError } from '../common/http';
import { AuthSession, Membership, Organization, User } from '../database/entities';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';

export const ACCESS_TTL_S = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export type Tokens = { accessToken: string; expiresIn: number; refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>,
    @InjectRepository(Membership) private readonly memberships: Repository<Membership>,
  ) {}

  /** Creates the user and their first organization (owner role) in one transaction. */
  async signup(input: { email: string; password: string; name: string; organizationName?: string }, userAgent?: string) {
    const email = input.email.trim().toLowerCase();
    if (await this.users.exist({ where: { email } }))
      throw new AppError(HttpStatus.CONFLICT, 'email_taken', 'Un compte existe déjà avec cet e-mail.');
    const passwordHash = await hashPassword(input.password);
    const user = await this.ds.transaction(async (tx) => {
      const u = await tx.save(tx.create(User, { email, passwordHash, name: input.name.trim() }));
      const org = await tx.save(tx.create(Organization, { name: input.organizationName?.trim() || `Espace de ${u.name}` }));
      await tx.save(tx.create(Membership, { organizationId: org.id, userId: u.id, role: 'owner' }));
      return u;
    });
    return { user, tokens: await this.issue(user.id, userAgent) };
  }

  async login(emailRaw: string, password: string, userAgent?: string) {
    const user = await this.users.findOne({ where: { email: emailRaw.trim().toLowerCase() } });
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new AppError(HttpStatus.UNAUTHORIZED, 'invalid_credentials', 'E-mail ou mot de passe incorrect.');
    return { user, tokens: await this.issue(user.id, userAgent) };
  }

  /** Rotates the refresh token. Reusing a rotated token revokes every session of the user. */
  async refresh(refreshToken: string | undefined, userAgent?: string): Promise<Tokens> {
    const invalid = new AppError(HttpStatus.UNAUTHORIZED, 'session_expired', 'Session expirée, reconnectez-vous.');
    if (!refreshToken) throw invalid;
    const s = await this.sessions.findOne({ where: { tokenHash: sha256(refreshToken) } });
    if (!s) throw invalid;
    if (s.revokedAt) {
      await this.sessions.update({ userId: s.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
      throw invalid;
    }
    if (s.expiresAt.getTime() < Date.now()) throw invalid;
    await this.sessions.update({ id: s.id }, { revokedAt: new Date() });
    return this.issue(s.userId, userAgent);
  }

  async logout(refreshToken: string | undefined) {
    if (refreshToken) await this.sessions.update({ tokenHash: sha256(refreshToken), revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async me(userId: string) {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    const ms = await this.memberships.find({ where: { userId }, relations: { organization: true }, order: { createdAt: 'ASC' } });
    return {
      user: { id: user.id, email: user.email, name: user.name },
      organizations: ms.map((m) => ({ id: m.organizationId, name: m.organization.name, role: m.role })),
    };
  }

  async updateMe(userId: string, patch: { name?: string }) {
    if (patch.name) await this.users.update({ id: userId }, { name: patch.name.trim() });
    return this.me(userId);
  }

  private async issue(userId: string, userAgent?: string): Promise<Tokens> {
    const refreshToken = randomBytes(32).toString('base64url');
    await this.sessions.save(
      this.sessions.create({
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        userAgent: userAgent?.slice(0, 300) ?? null,
        revokedAt: null,
      }),
    );
    const accessToken = await this.jwt.signAsync({ sub: userId, typ: 'access' }, { expiresIn: ACCESS_TTL_S });
    return { accessToken, expiresIn: ACCESS_TTL_S, refreshToken };
  }
}
