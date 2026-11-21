// Domain entities (PostgreSQL). Schema changes go through migrations (synchronize is off).
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { MediaKind } from '../files/media-kinds';

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';
export const ROLES: Role[] = ['owner', 'admin', 'editor', 'viewer'];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  /** Stored lower-cased; unique. */
  @Index({ unique: true }) @Column('citext') email: string;
  @Column('text', { name: 'password_hash' }) passwordHash: string;
  @Column('text') name: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') name: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}

@Entity('memberships')
@Index(['organizationId', 'userId'], { unique: true })
export class Membership {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'organization_id' }) organizationId: string;
  @Index() @Column('uuid', { name: 'user_id' }) userId: string;
  @Column('text') role: Role;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: User;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}

/** Refresh-token sessions (only the SHA-256 hash of the token is stored). */
@Entity('auth_sessions')
export class AuthSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid', { name: 'user_id' }) userId: string;
  @Index({ unique: true }) @Column('text', { name: 'token_hash' }) tokenHash: string;
  @Column('timestamptz', { name: 'expires_at' }) expiresAt: Date;
  @Column('timestamptz', { name: 'revoked_at', nullable: true }) revokedAt: Date | null;
  @Column('text', { name: 'user_agent', nullable: true }) userAgent: string | null;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: User;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}

export type ProjectType = 'real-estate' | 'logistics' | 'laboratory' | 'industry' | 'other';
export const PROJECT_TYPES: ProjectType[] = ['real-estate', 'logistics', 'laboratory', 'industry', 'other'];

/** Editable content of a tour (scenes, 3D objects, library assets…), versioned by `revision`. */
export type ProjectDocument = {
  scenes: unknown[];
  hotspots?: unknown[];
  annotations?: unknown[];
  floorPlans?: unknown[];
  guidedTours?: unknown[];
  navigation?: unknown[];
  objects: unknown[];
  assets: unknown[];
  favorites: string[];
  settings: Record<string, unknown>;
};

@Entity('projects')
@Index(['organizationId', 'updatedAt'])
export class Project {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid', { name: 'organization_id' }) organizationId: string;
  @Column('uuid', { name: 'created_by', nullable: true }) createdBy: string | null;
  @Column('text') name: string;
  @Column('text', { default: 'other' }) type: ProjectType;
  @Column('text', { nullable: true }) description: string | null;
  @Column('int', { default: 1 }) revision: number;
  @Column('jsonb') document: ProjectDocument;
  @Column('int', { name: 'published_revision', nullable: true }) publishedRevision: number | null;
  @Column('timestamptz', { name: 'published_at', nullable: true }) publishedAt: Date | null;
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;
}

export type Visibility = 'unlisted' | 'public';

/** Immutable snapshot served to visitors. One row per project (replaced on update). */
@Entity('publications')
export class Publication {
  @PrimaryColumn('uuid', { name: 'project_id' }) projectId: string;
  @Column('int') revision: number;
  @Column('text') name: string;
  @Column('text') type: ProjectType;
  @Column('text', { nullable: true }) description: string | null;
  @Column('jsonb') document: ProjectDocument;
  /** unlisted = accessible by link only; public = also listed in the visitor gallery. */
  @Column('text', { default: 'unlisted' }) visibility: Visibility;
  @Column('timestamptz', { name: 'published_at' }) publishedAt: Date;
  /** scrypt hash; null = no password. */
  @Column('text', { name: 'password_hash', nullable: true }) passwordHash: string | null;
  @Column('timestamptz', { name: 'expires_at', nullable: true }) expiresAt: Date | null;
  @Column('int', { name: 'access_version', default: 1 }) accessVersion: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'project_id' }) project: Project;
}

/** Uploaded file. Bytes live in S3 under `storage_key`; never exposed to clients. */
@Entity('media_files')
export class MediaFile {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid', { name: 'organization_id' }) organizationId: string;
  @Index() @Column('uuid', { name: 'project_id' }) projectId: string;
  @Column('uuid', { name: 'uploaded_by', nullable: true }) uploadedBy: string | null;
  @Column('text', { name: 'storage_key' }) storageKey: string;
  @Column('text', { name: 'original_name' }) originalName: string;
  @Column('text', { name: 'mime_type' }) mimeType: string;
  @Column('bigint', { transformer: { to: (v: number) => v, from: (v: string) => Number(v) } }) size: number;
  @Column('text') sha256: string;
  @Column('text', { default: 'model' }) kind: MediaKind;
  @Column('text', { nullable: true }) folder: string | null;
  @Column('boolean', { default: false }) favorite: boolean;
  @Column('int', { nullable: true }) width: number | null;
  @Column('int', { nullable: true }) height: number | null;
  /** Trash: soft-deleted files can be restored until permanently deleted. */
  @Column('timestamptz', { name: 'deleted_at', nullable: true }) deletedAt: Date | null;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'project_id' }) project: Project;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}

/** Anonymous visitor session recorded by the viewer. */
@Entity('viewer_sessions')
@Index(['projectId', 'startedAt'])
export class ViewerSession {
  /** Client-generated id so duration updates are idempotent upserts. */
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'project_id' }) projectId: string;
  @Column('text', { name: 'visitor_id' }) visitorId: string;
  @Column('timestamptz', { name: 'started_at' }) startedAt: Date;
  @Column('int', { name: 'duration_ms', default: 0 }) durationMs: number;
  @Column('int', { name: 'scenes_viewed', default: 0 }) scenesViewed: number;
  @ManyToOne(() => Project, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'project_id' }) project: Project;
}

export const ENTITIES = [User, Organization, Membership, AuthSession, Project, Publication, MediaFile, ViewerSession];
