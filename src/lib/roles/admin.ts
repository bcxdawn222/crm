import { Prisma } from '@prisma/client'
import { z } from 'zod'

import type { AuditDbClient } from '@/lib/audit/record'


const permissionIdsSchema = z
  .array(z.string().uuid('权限 ID 不正确'))
  .min(1, '至少选择一个权限')
  .refine((permissionIds) => new Set(permissionIds).size === permissionIds.length, '权限不能重复')

export const updateRoleSchema = z.object({
  displayName: z.string().trim().min(1, '显示名称不能为空').max(100, '显示名称不能超过 100 个字符').optional(),
  description: z.union([z.string().trim().max(255, '描述不能超过 255 个字符'), z.null()]).optional(),
  permissionIds: permissionIdsSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, '没有需要保存的角色字段')

export const roleAdminSelect = {
  id: true,
  name: true,
  displayName: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true, permissions: true } },
  permissions: {
    select: {
      permission: { select: { id: true, code: true, name: true, module: true } },
    },
  },
} satisfies Prisma.RoleSelect

export type AdminRoleRecord = Prisma.RoleGetPayload<{ select: typeof roleAdminSelect }>

export class RoleAdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'RoleAdminError'
  }
}

export function roleResponse(role: AdminRoleRecord) {
  return {
    id: role.id,
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    userCount: role._count.users,
    permissionCount: role._count.permissions,
    permissionIds: role.permissions.map(({ permission }) => permission.id),
    permissions: role.permissions.map(({ permission }) => permission.code),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }
}

export function roleAuditSnapshot(role: AdminRoleRecord) {
  return {
    id: role.id,
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    permissionIds: role.permissions.map(({ permission }) => permission.id),
    permissions: role.permissions.map(({ permission }) => permission.code),
  }
}

export async function validatePermissionSelection(
  db: AuditDbClient,
  roleName: string,
  permissionIds: string[],
): Promise<void> {
  const permissions = await db.permission.findMany({
    where: { id: { in: permissionIds } },
    select: { id: true },
  })
  if (permissions.length !== permissionIds.length) {
    throw new RoleAdminError('选择的权限不存在或已被删除', 400)
  }
  if (roleName !== 'admin') return

  const allPermissionIds = await db.permission.findMany({ select: { id: true } })
  const selected = new Set(permissionIds)
  if (allPermissionIds.some(({ id }) => !selected.has(id))) {
    throw new RoleAdminError('管理员角色必须保留全部权限', 400)
  }
}
