import { Prisma } from '@prisma/client'

import { prisma } from './prisma'

export interface TeamTreeNode {
  id: string
  username: string
  realName: string
  department: string | null
  position: string | null
  children?: TeamTreeNode[]
}

export async function getAccessibleUserIds(
  userId: string,
  userRoles: readonly string[]
): Promise<string[] | null> {
  if (userRoles.includes('admin') || userRoles.includes('finance')) {
    return null
  }
  if (userRoles.includes('sales_manager') || userRoles.includes('sales')) {
    return getUserAndSubordinateIds(userId)
  }
  return []
}

/**
 * 获取用户及其所有下属的ID列表(递归)
 * @param userId 用户ID
 * @returns 包含用户自己和所有下属的ID数组
 */
export async function getUserAndSubordinateIds(userId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH RECURSIVE user_tree (id, visited) AS (
      SELECT id, CAST(id AS CHAR(4000) CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci
      FROM User
      WHERE id = ${userId}
      UNION ALL
      SELECT child.id, CONCAT(parent.visited, ',', child.id) COLLATE utf8mb4_unicode_ci
      FROM User child
      INNER JOIN user_tree parent ON child.managerId = parent.id
      WHERE FIND_IN_SET(
        child.id COLLATE utf8mb4_unicode_ci,
        parent.visited COLLATE utf8mb4_unicode_ci
      ) = 0
    )
    SELECT DISTINCT id FROM user_tree
  `)
  return rows.map((row) => row.id)
}

/**
 * 根据用户角色和权限生成数据过滤条件
 * @param userId 当前用户ID
 * @param userRoles 用户角色列表
 * @returns Prisma查询的where条件对象
 */
export async function buildDataFilter(
  userId: string,
  userRoles: readonly string[]
): Promise<{ salesId?: { in: string[] } }> {
  const accessibleUserIds = await getAccessibleUserIds(userId, userRoles)
  return accessibleUserIds === null ? {} : { salesId: { in: accessibleUserIds } }
}

/**
 * 检查用户是否有权限访问指定销售的数据
 * @param currentUserId 当前用户ID
 * @param currentUserRoles 当前用户角色
 * @param targetSalesId 目标销售ID
 * @returns 是否有权限
 */
export async function canAccessSalesData(
  currentUserId: string,
  currentUserRoles: readonly string[],
  targetSalesId: string
): Promise<boolean> {
  const accessibleUserIds = await getAccessibleUserIds(currentUserId, currentUserRoles)
  return accessibleUserIds === null || accessibleUserIds.includes(targetSalesId)
}

/**
 * 获取用户的直接下属列表
 * @param userId 用户ID
 * @returns 下属用户列表
 */
export async function getDirectSubordinates(userId: string) {
  return await prisma.user.findMany({
    where: { managerId: userId },
    select: {
      id: true,
      username: true,
      realName: true,
      department: true,
      position: true
    }
  })
}

/**
 * 获取用户的完整团队树(包括所有层级)
 * @param userId 用户ID
 * @returns 团队树结构
 */
export async function getTeamTree(userId: string): Promise<TeamTreeNode[]> {
  const subordinates = await prisma.user.findMany({
    where: { managerId: userId },
    select: {
      id: true,
      username: true,
      realName: true,
      department: true,
      position: true
    }
  })
  
  const tree: TeamTreeNode[] = []
  for (const sub of subordinates) {
    const children = await getTeamTree(sub.id)
    tree.push({
      ...sub,
      children: children.length > 0 ? children : undefined
    })
  }
  
  return tree
}
