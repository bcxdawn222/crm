import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PrismaClient, type Prisma } from '@prisma/client'

import {
  accounts,
  assertTestEnvironment,
  authRoot,
  fixtureNames,
  marker,
  password,
  runId,
  settingsSnapshotPath,
  type RoleKey,
} from './environment'


export const prisma = new PrismaClient()
const settingKeys = ['systemName', 'companyName'] as const

interface SettingSnapshotRow {
  key: string
  value: string
  updatedBy: string | null
}

function roleName(role: RoleKey): string {
  if (role === 'manager') return 'sales_manager'
  if (role === 'restricted') return `e2e_restricted_${runId}`
  return role
}

async function snapshotSettings(): Promise<void> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...settingKeys] } },
    select: { key: true, value: true, updatedBy: true },
  })
  await mkdir(path.dirname(settingsSnapshotPath), { recursive: true })
  await writeFile(settingsSnapshotPath, JSON.stringify(rows), { encoding: 'utf8' })
}

async function restoreSettings(): Promise<void> {
  let rows: SettingSnapshotRow[] = []
  try {
    rows = JSON.parse(await readFile(settingsSnapshotPath, 'utf8')) as SettingSnapshotRow[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return
  }
  const originalKeys = new Set(rows.map((row) => row.key))
  await prisma.systemSetting.deleteMany({
    where: { key: { in: settingKeys.filter((key) => !originalKeys.has(key)) } },
  })
  for (const row of rows) {
    await prisma.systemSetting.upsert({
      where: { key: row.key },
      create: row,
      update: { value: row.value, updatedBy: row.updatedBy },
    })
  }
}

async function removeFixtureFiles(paths: string[]): Promise<void> {
  const uploadRoot = path.resolve(process.env.CRM_UPLOAD_DIR || path.join('storage', 'test'))
  for (const key of paths) {
    const target = path.resolve(uploadRoot, key)
    if (target !== uploadRoot && !target.startsWith(`${uploadRoot}${path.sep}`)) {
      throw new Error(`拒绝清理上传目录之外的文件: ${target}`)
    }
    await rm(target, { force: true })
  }
}

export async function cleanupE2EFixtures(): Promise<void> {
  assertTestEnvironment()
  await restoreSettings()
  const users = await prisma.user.findMany({
    where: { username: { startsWith: `e2e_${runId}_` } },
    select: { id: true },
  })
  const userIds = users.map((user) => user.id)
  const customers = await prisma.customer.findMany({
    where: { notes: { contains: marker } },
    select: { id: true },
  })
  const customerIds = customers.map((customer) => customer.id)
  const files = await prisma.file.findMany({
    where: { originalName: { contains: runId } },
    select: { id: true, path: true },
  })
  const fileIds = files.map((file) => file.id)
  const orders = await prisma.order.findMany({
    where: { OR: [{ customerId: { in: customerIds } }, { salesId: { in: userIds } }] },
    select: { id: true },
  })
  const orderIds = orders.map((order) => order.id)
  const entityIds = [...customerIds, ...fileIds, ...orderIds]

  await removeFixtureFiles(files.map((file) => file.path))
  await prisma.$transaction([
    prisma.auditEvent.deleteMany({
      where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: entityIds } }] },
    }),
    prisma.payment.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { operatorId: { in: userIds } }] } }),
    prisma.contractArchive.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { archivedBy: { in: userIds } }] } }),
    prisma.followUp.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { salesId: { in: userIds } }] } }),
    prisma.lead.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { salesId: { in: userIds } }] } }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.telemarketingList.deleteMany({ where: { OR: [{ customerId: { in: customerIds } }, { salesId: { in: userIds } }] } }),
    prisma.task.deleteMany({ where: { OR: [{ assigneeId: { in: userIds } }, { creatorId: { in: userIds } }] } }),
    prisma.file.deleteMany({ where: { id: { in: fileIds } } }),
    prisma.message.deleteMany({ where: { OR: [{ senderId: { in: userIds } }, { receiverId: { in: userIds } }] } }),
    prisma.dailyReport.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { reviewedBy: { in: userIds } }] } }),
    prisma.customer.deleteMany({ where: { id: { in: customerIds } } }),
    prisma.user.updateMany({ where: { id: { in: userIds } }, data: { managerId: null } }),
    prisma.userRole.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.role.deleteMany({ where: { name: `e2e_restricted_${runId}` } }),
  ])
  await rm(settingsSnapshotPath, { force: true })
  await rm(authRoot, { recursive: true, force: true })
}

export async function ensureE2EFixtures(): Promise<void> {
  assertTestEnvironment()
  await cleanupE2EFixtures()
  await snapshotSettings()
  const requiredRoles = await prisma.role.findMany({
    where: { name: { in: ['admin', 'sales_manager', 'sales'] } },
    select: { id: true, name: true },
  })
  if (requiredRoles.length !== 3) throw new Error('test 数据库缺少 admin、sales_manager 或 sales 角色')
  const restrictedRole = await prisma.role.create({
    data: {
      name: `e2e_restricted_${runId}`,
      displayName: `E2E受限角色-${runId}`,
      description: marker,
    },
  })
  const roleIds = new Map(requiredRoles.map((role) => [role.name, role.id]))
  roleIds.set(restrictedRole.name, restrictedRole.id)
  const hash = await bcrypt.hash(password, 10)
  const userIds = new Map<RoleKey, string>()

  for (const role of ['admin', 'manager', 'sales', 'restricted'] as const) {
    const account = accounts[role]
    const user = await prisma.user.create({
      data: {
        username: account.username,
        email: `${account.username}@example.test`,
        password: hash,
        realName: account.realName,
        department: 'E2E测试部',
        position: role,
        status: 'ACTIVE',
        managerId: role === 'sales' ? userIds.get('manager') : null,
        maxActiveCustomers: 100,
        maxDailyClaims: 20,
      },
    })
    const assignedRoleId = roleIds.get(roleName(role))
    if (!assignedRoleId) throw new Error(`找不到 ${role} 对应角色`)
    await prisma.userRole.create({ data: { userId: user.id, roleId: assignedRoleId } })
    userIds.set(role, user.id)
  }

  const salesId = userIds.get('sales')
  const managerId = userIds.get('manager')
  const adminId = userIds.get('admin')
  if (!salesId || !managerId || !adminId) throw new Error('E2E 用户创建不完整')
  const customers: Prisma.CustomerCreateManyInput[] = Array.from({ length: 25 }, (_, index) => ({
    id: randomUUID(),
    name: `${fixtureNames.salesPrefix}-${String(index + 1).padStart(2, '0')}`,
    company: `E2E分页公司-${index + 1}`,
    phone: `15${String(parseInt(runId.slice(0, 8), 16)).slice(0, 8)}${String(index).padStart(2, '0')}`,
    source: 'OTHER' as const,
    level: 'POTENTIAL' as const,
    status: 'ACTIVE' as const,
    salesId,
    notes: marker,
  }))
  customers.push(
    {
      id: randomUUID(), name: fixtureNames.managerCustomer, company: 'E2E主管公司',
      phone: `16${runId.slice(0, 10)}`, source: 'OTHER', level: 'NORMAL', status: 'ACTIVE', salesId: managerId, notes: marker,
    },
    {
      id: randomUUID(), name: fixtureNames.adminCustomer, company: 'E2E管理公司',
      phone: `17${runId.slice(0, 10)}`, source: 'OTHER', level: 'NORMAL', status: 'ACTIVE', salesId: adminId, notes: marker,
    },
    {
      id: randomUUID(), name: fixtureNames.cooperatingCustomer, company: 'E2E合作公司',
      phone: `14${runId.slice(0, 10)}`, source: 'OTHER', level: 'IMPORTANT', status: 'COOPERATING',
      salesId: adminId, notes: marker, contractStartDate: new Date(),
      contractEndDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), contractAmount: 128000,
      renewalReminderDays: 30, nextVisitAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      visitFrequency: 'MONTHLY', cooperationNotes: marker, operationManagerId: adminId,
    },
  )
  await prisma.customer.createMany({ data: customers })
  await prisma.customer.create({
    data: {
      id: randomUUID(),
      name: fixtureNames.publicCustomer,
      company: 'E2E公海公司',
      phone: `18${runId.slice(0, 10)}`,
      source: 'OTHER',
      level: 'POTENTIAL',
      status: 'INACTIVE',
      salesId: managerId,
      isPublic: true,
      originalSalesId: managerId,
      publicPoolEnteredAt: new Date(),
      publicPoolReason: 'MANUAL_ARCHIVE',
      notes: marker,
    },
  })
  await prisma.telemarketingList.create({
    data: {
      name: fixtureNames.telemarketing,
      company: 'E2E电销公司',
      phone: `19${runId.slice(0, 10)}`,
      source: marker,
      status: 'PENDING',
      salesId: adminId,
      notes: marker,
    },
  })
  await prisma.dailyReport.create({
    data: {
      userId: adminId,
      title: fixtureNames.dailyReport,
      content: marker,
      workSummary: marker,
      tomorrowPlan: '继续跟进测试客户',
      reportDate: new Date(new Date().toISOString().slice(0, 10)),
      status: 'SUBMITTED',
    },
  })
}
