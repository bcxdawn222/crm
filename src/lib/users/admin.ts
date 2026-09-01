import { Prisma, UserStatus } from '@prisma/client'
import { z } from 'zod'

import type { AuditDbClient } from '@/lib/audit/record'


const usernameSchema = z
  .string()
  .trim()
  .min(3, '用户名至少 3 个字符')
  .max(50, '用户名不能超过 50 个字符')
  .regex(/^[A-Za-z0-9_.-]+$/, '用户名只能包含字母、数字、下划线、点和短横线')

const nullableText = (max: number, label: string) => z
  .union([z.string().trim().max(max, `${label}不能超过 ${max} 个字符`), z.null()])
  .optional()

const roleIdsSchema = z
  .array(z.string().uuid('角色 ID 不正确'))
  .refine((roleIds) => new Set(roleIds).size === roleIds.length, '角色不能重复')

export const createUserSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email('邮箱格式不正确').max(100, '邮箱不能超过 100 个字符'),
  password: z.string().min(6, '密码至少 6 个字符').max(72, '密码不能超过 72 个字符'),
  realName: z.string().trim().max(50, '姓名不能超过 50 个字符'),
  phone: nullableText(20, '电话'),
  department: nullableText(50, '部门'),
  position: nullableText(50, '职位'),
  managerId: z.string().uuid('上级 ID 不正确').nullable().optional(),
  roleIds: roleIdsSchema,
})

export const updateUserSchema = z.object({
  username: usernameSchema.optional(),
  email: z.string().trim().email('邮箱格式不正确').max(100, '邮箱不能超过 100 个字符').optional(),
  password: z.string().min(6, '密码至少 6 个字符').max(72, '密码不能超过 72 个字符').optional(),
  realName: z.string().trim().max(50, '姓名不能超过 50 个字符').optional(),
  phone: nullableText(20, '电话'),
  department: nullableText(50, '部门'),
  position: nullableText(50, '职位'),
  managerId: z.string().uuid('上级 ID 不正确').nullable().optional(),
  roleIds: roleIdsSchema.optional(),
  status: z.nativeEnum(UserStatus).optional(),
}).refine((value) => Object.keys(value).length > 0, '没有需要保存的用户字段')

export const userAdminSelect = {
  id: true,
  username: true,
  email: true,
  realName: true,
  phone: true,
  department: true,
  position: true,
  status: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  manager: { select: { id: true, realName: true } },
  roles: {
    select: {
      role: { select: { id: true, name: true, displayName: true } },
    },
  },
} satisfies Prisma.UserSelect

export type AdminUserRecord = Prisma.UserGetPayload<{ select: typeof userAdminSelect }>

export class UserAdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'UserAdminError'
  }
}

export function nullableValue(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value
  return value || null
}

export function userAuditSnapshot(user: AdminUserRecord) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    realName: user.realName,
    phone: user.phone,
    department: user.department,
    position: user.position,
    status: user.status,
    managerId: user.managerId,
    roleIds: user.roles.map(({ role }) => role.id),
  }
}

export async function assertRolesExist(db: AuditDbClient, roleIds: string[]): Promise<void> {
  const count = await db.role.count({ where: { id: { in: roleIds } } })
  if (count !== roleIds.length) {
    throw new UserAdminError('选择的角色不存在或已被删除', 400)
  }
}

export async function assertManagerAssignment(
  db: AuditDbClient,
  userId: string | undefined,
  managerId: string | null | undefined,
): Promise<void> {
  if (!managerId) return
  if (managerId === userId) {
    throw new UserAdminError('用户不能设置自己为上级', 400)
  }
  const manager = await db.user.findUnique({
    where: { id: managerId },
    select: { id: true, managerId: true, status: true },
  })
  if (!manager || manager.status !== UserStatus.ACTIVE) {
    throw new UserAdminError('选择的上级不存在或未启用', 400)
  }
  if (!userId) return

  const visited = new Set<string>()
  let current: { id: string; managerId: string | null } | null = manager
  while (current?.managerId) {
    if (current.managerId === userId) {
      throw new UserAdminError('上级关系会形成循环', 400)
    }
    if (visited.has(current.managerId)) {
      throw new UserAdminError('现有上级关系存在循环，请先修复数据', 409)
    }
    visited.add(current.managerId)
    current = await db.user.findUnique({
      where: { id: current.managerId },
      select: { id: true, managerId: true },
    })
  }
}
