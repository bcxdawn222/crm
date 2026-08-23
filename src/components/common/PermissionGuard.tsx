'use client'

import { ReactNode } from 'react'
import { usePermission } from '@/hooks/usePermission'
import type { Actions, Subjects } from '@/lib/casl'

interface PermissionGuardProps {
  /** 允许的操作 */
  action?: Actions
  /** 允许的资源类型 */
  subject?: Subjects
  /** 权限检查函数,返回true表示有权限 */
  check?: (can: (action: Actions, subject: Subjects) => boolean) => boolean
  /** 无权限时显示的内容 */
  fallback?: ReactNode
  /** 子组件 */
  children: ReactNode
}

/**
 * 权限守卫组件
 * 
 * 用法1: 基于action和subject检查
 * ```tsx
 * <PermissionGuard action="create" subject="customer">
 *   <Button>新增客户</Button>
 * </PermissionGuard>
 * ```
 * 
 * 用法2: 使用自定义检查函数
 * ```tsx
 * <PermissionGuard check={(can) => can('create', 'customer') || can('update', 'customer')}>
 *   <Button>操作</Button>
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  action,
  subject,
  check,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { can } = usePermission()
  
  let hasPermission = false
  
  if (check) {
    // 使用自定义检查函数
    hasPermission = check(can)
  } else if (action && subject) {
    // 使用action和subject检查
    hasPermission = can(action, subject)
  }
  
  return hasPermission ? <>{children}</> : <>{fallback}</>
}
