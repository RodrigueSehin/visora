import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import helmet from 'helmet';
import { DataSource } from 'typeorm';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './common/auth.guard';
import { ErrorFilter, Public } from './common/http';
import { config } from './config';
import { dataSourceOptions } from './database/data-source';
import { ENTITIES } from './database/entities';
import { FilesController } from './files/files.controller';
import { FilesService } from './files/files.service';
import { StorageService } from './files/storage.service';
import { AccessService } from './orgs/access.service';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';
import { PublicController } from './public/public.controller';
import { StatsController } from './stats/stats.controller';

@Controller('api/health')
class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  @Public()
  @Get()
  async health() {
    await this.ds.query('SELECT 1');
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => ({ ...dataSourceOptions(), migrationsRun: true }) }),
    TypeOrmModule.forFeature(ENTITIES),
    JwtModule.registerAsync({ useFactory: () => ({ secret: config().JWT_SECRET, signOptions: { algorithm: 'HS256' }, verifyOptions: { algorithms: ['HS256'] } }) }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }]),
  ],
  controllers: [HealthController, AuthController, ProjectsController, FilesController, PublicController, StatsController],
  providers: [
    AuthService,
    AccessService,
    ProjectsService,
    StorageService,
    FilesService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
export class AppModule {}

/** HTTP hardening shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication) {
  const c = config();
  const http = app.getHttpAdapter().getInstance();
  http.set('trust proxy', 1);
  http.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(json({ limit: '10mb' }));
  app.use(cookieParser());
  app.enableCors({ origin: c.CORS_ORIGIN.split(',').map((s) => s.trim()), credentials: true });
  app.enableShutdownHooks();
}
