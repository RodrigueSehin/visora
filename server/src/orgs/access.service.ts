// Server-side authorization. Every project/file access goes through here: the UI hiding
// a button is never what protects data.
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { forbidden, notFound } from '../common/http';
import { Membership, Project, type Role } from '../database/entities';

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };
export const canRole = (role: Role, min: Role) => RANK[role] >= RANK[min];

@Injectable()
export class AccessService {
  constructor(
    @InjectRepository(Membership) private readonly memberships: Repository<Membership>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
  ) {}

  /** Role of the user in the organization; 404 when not a member (does not reveal existence). */
  async orgRole(userId: string, organizationId: string, min: Role = 'viewer'): Promise<Role> {
    const m = await this.memberships.findOne({ where: { userId, organizationId } });
    if (!m) throw notFound('Organisation');
    if (!canRole(m.role, min)) throw forbidden();
    return m.role;
  }

  /** Loads a (non-deleted) project the user may access with at least `min` role. */
  async project(userId: string, projectId: string, min: Role = 'viewer'): Promise<{ project: Project; role: Role }> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw notFound('Projet');
    const role = await this.orgRole(userId, project.organizationId, 'viewer').catch(() => {
      throw notFound('Projet');
    });
    if (!canRole(role, min)) throw forbidden();
    return { project, role };
  }
}
