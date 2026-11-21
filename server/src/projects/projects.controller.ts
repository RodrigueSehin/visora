import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, ZodPipe, type AuthUser } from '../common/http';
import { documentSchema, projectMetaSchema, ProjectsService } from './projects.service';

const createSchema = projectMetaSchema.extend({ document: documentSchema });
const saveSchema = projectMetaSchema.extend({
  document: documentSchema,
  baseRevision: z.number().int().min(0),
  force: z.boolean().optional(),
});
const publishSchema = z.object({ revision: z.number().int().min(1), visibility: z.enum(['unlisted', 'public']).optional() });
const visibilitySchema = z.object({
  visibility: z.enum(['unlisted', 'public']).optional(),
  password: z.string().min(4, 'Au moins 4 caractères').max(200).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('api')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('orgs/:orgId/projects')
  list(@CurrentUser() u: AuthUser, @Param('orgId', uuid) orgId: string) {
    return this.projects.list(u.id, orgId);
  }

  @Post('orgs/:orgId/projects')
  create(@CurrentUser() u: AuthUser, @Param('orgId', uuid) orgId: string, @Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>) {
    return this.projects.create(u.id, orgId, body);
  }

  @Get('projects/:id')
  get(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string) {
    return this.projects.get(u.id, id);
  }

  @Put('projects/:id')
  save(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(saveSchema)) body: z.infer<typeof saveSchema>) {
    return this.projects.save(u.id, id, body);
  }

  @Delete('projects/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string) {
    return this.projects.remove(u.id, id);
  }

  @Post('projects/:id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(publishSchema)) body: z.infer<typeof publishSchema>) {
    return this.projects.publish(u.id, id, body.revision, body.visibility);
  }

  @Post('projects/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string) {
    return this.projects.unpublish(u.id, id);
  }

  @Patch('projects/:id/publication')
  visibility(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(visibilitySchema)) body: z.infer<typeof visibilitySchema>) {
    return this.projects.updateShare(u.id, id, body);
  }
}
