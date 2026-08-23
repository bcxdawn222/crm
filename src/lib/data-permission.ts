import { prisma } from './prisma'

/**
 * 获取用户及其所有下属的ID列表(递归)
 * @param userId 用户ID
 * @returns 包含用户自己和所有下属的ID数组
 */
export async function getUserAndSubordinateIds(userId: string): Promise<string[]> {
  const ids = new Set<string>([userId])
  
  // 递归获取所有下属
  async function getSubordinates(parentId: string) {
    const subordinates = await prisma.user.findMany({
      where: { managerId: parentId },
      select: { id: true }
    })
    
    for (const sub of subordinates) {
      if (!ids.has(sub.id)) {
        ids.add(sub.id)
        // 递归获取下属的下属
        await getSubordinates(sub.id)
      }
    }
  }
  
  await getSubordinates(userId)
  return Array.from(ids)
}

/**
 * 根据用户角色和权限生成数据过滤条件
 * @param userId 当前用户ID
 * @param userRoles 用户角色列表
 * @returns Prisma查询的where条件对象
 */
export async function buildDataFilter(
  userId: string,
  userRoles: string[]
): Promise<{ salesId?: { in: string[] } } | {}> {
  // Admin可以查看所有数据
  if (userRoles.includes('admin')) {
    return {}
  }
  
  // Sales Manager和Sales只能查看自己和下属的数据
  if (userRoles.includes('sales_manager') || userRoles.includes('sales')) {
    const accessibleUserIds = await getUserAndSubordinateIds(userId)
    return {
      salesId: { in: accessibleUserIds }
    }
  }
  
  // Finance可以查看所有数据(财务需要全局视角)
  if (userRoles.includes('finance')) {
    return {}
  }
  
  // 默认返回空过滤器(无权限)
  return {}
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
  currentUserRoles: string[],
  targetSalesId: string
): Promise<boolean> {
  // Admin可以访问所有数据
  if (currentUserRoles.includes('admin')) {
    return true
  }
  
  // Finance可以访问所有数据
  if (currentUserRoles.includes('finance')) {
    return true
  }
  
  // Sales Manager和Sales只能访问自己和下属的数据
  if (currentUserRoles.includes('sales_manager') || currentUserRoles.includes('sales')) {
    const accessibleUserIds = await getUserAndSubordinateIds(currentUserId)
    return accessibleUserIds.includes(targetSalesId)
  }
  
  return false
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
export async function getTeamTree(userId: string): Promise<any[]> {
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
  
  const tree = []
  for (const sub of subordinates) {
    const children = await getTeamTree(sub.id)
    tree.push({
      ...sub,
      children: children.length > 0 ? children : undefined
    })
  }
  
  return tree
}
