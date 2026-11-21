import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { config } from '../config';
import { CurrentUser, Public, ZodPipe, type AuthUser } from '../common/http';
import { FilesService } from './files.service';
import { MEDIA_KINDS } from './media-kinds';

const uuid = new ParseUUIDPipe({ version: '4' });
const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  folder: z.string().trim().max(80).nullable().optional(),
  favorite: z.boolean().optional(),
  kind: z.enum(MEDIA_KINDS as [string, ...string[]]).optional(),
});
const uploadQuery = z.object({ folder: z.string().trim().max(80).optional() });

@Controller('api')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('projects/:id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      // Streamed to a temp file (not memory), then validated and pushed to S3.
      storage: diskStorage({ destination: tmpdir() }),
      limits: { fileSize: config().MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
    }),
  )
  upload(@CurrentUser() u: AuthUser, @Param('id', uuid) projectId: string, @UploadedFile() file: Express.Multer.File, @Query(new ZodPipe(uploadQuery)) q: z.infer<typeof uploadQuery>) {
    return this.files.upload(u.id, projectId, file, q.folder);
  }

  @Get('projects/:id/files')
  list(@CurrentUser() u: AuthUser, @Param('id', uuid) projectId: string, @Query('trash') trash?: string) {
    return this.files.list(u.id, projectId, trash === '1');
  }

  @Patch('files/:id')
  update(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(patchSchema)) body: z.infer<typeof patchSchema>) {
    return this.files.update(u.id, id, body as Parameters<FilesService['update']>[2]);
  }

  /** Moves the file to the trash (restorable). */
  @Delete('files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  trash(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string) {
    return this.files.trash(u.id, id);
  }

  @Post('files/:id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string) {
    return this.files.restore(u.id, id);
  }

  @Delete('files/:id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  destroy(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string) {
    return this.files.destroy(u.id, id);
  }

  @Get('files/:id/url')
  url(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string) {
    return this.files.signedUrl(u.id, id);
  }

  @Get('files/:id/content')
  async content(@CurrentUser() u: AuthUser, @Param('id', uuid) id: string, @Req() req: Request, @Res() res: Response) {
    await this.files.streamForMember(u.id, id, req, res);
  }

  /** Signed media URL (used by <img>/<video>/<audio>; no Authorization header possible there). */
  @Public()
  @Get('media/:id')
  async media(@Param('id', uuid) id: string, @Query('exp') exp: string, @Query('sig') sig: string, @Req() req: Request, @Res() res: Response) {
    await this.files.streamSigned(id, exp, sig, req, res);
  }
}
