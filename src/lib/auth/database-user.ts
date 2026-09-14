import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ensureSalesDailyReportPermissionsOnce } from '@/lib/roles/ensure-sales-daily-report'


export interface AuthenticatedDatabaseUser {
  id: string
  username: string
  email: string
  realName: string
  roles: string[]
  permissions: string[]
}

const authenticatedUserInclude = Prisma.validator<Prisma.UserInclude>()({
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
})

type AuthenticatedUserRecord = Prisma.UserGetPayload<{
  include: typeof authenticatedUserInclude
}>

function toAuthenticatedDatabaseUser(user: AuthenticatedUserRecord): AuthenticatedDatabaseUser {
  const roles = user.roles.map(({ role }) => role.name)
  const permissions = Array.from(
    new Set(
      user.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.code)
      )
    )
  )
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    realName: user.realName,
    roles,
    permissions,
  }
}

export async function loadActiveDatabaseUserById(
  id: string
): Promise<AuthenticatedDatabaseUser | null> {
  await ensureSalesDailyReportPermissionsOnce()
  const user = await prisma.user.findUnique({
    where: { id },
    include: authenticatedUserInclude,
  })
  return user?.status === 'ACTIVE' ? toAuthenticatedDatabaseUser(user) : null
}


export async function authenticateDatabaseUser(
  username: string,
  password: string
): Promise<AuthenticatedDatabaseUser | null> {
  await ensureSalesDailyReportPermissionsOnce()
  const user = await prisma.user.findUnique({
    where: { username },
    include: authenticatedUserInclude,
  })

  if (!user || user.status !== 'ACTIVE') {
    return null
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return null
  }

  return toAuthenticatedDatabaseUser(user)
}
