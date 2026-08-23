import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import type { MongoAbility } from '@casl/ability'

// 定义权限类型
export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'review' | 'export' | 'import'
export type Subjects = 
  | 'customer'
  | 'lead'
  | 'followUp'
  | 'order'
  | 'payment'
  | 'report'
  | 'message'
  | 'task'
  | 'file'
  | 'user'
  | 'role'
  | 'setting'
  | 'all'

export type AppAbility = MongoAbility<[Actions, Subjects]>

// 角色枚举
export enum Role {
  ADMIN = 'admin',
  SALES_MANAGER = 'sales_manager',
  SALES = 'sales',
  FINANCE = 'finance',
}

// 权限点定义
export const PERMISSIONS = {
  // 客户管理
  'customer:view': { action: 'read', subject: 'customer' },
  'customer:create': { action: 'create', subject: 'customer' },
  'customer:update': { action: 'update', subject: 'customer' },
  'customer:delete': { action: 'delete', subject: 'customer' },
  'customer:export': { action: 'export', subject: 'customer' },
  
  // 销售线索
  'lead:view': { action: 'read', subject: 'lead' },
  'lead:create': { action: 'create', subject: 'lead' },
  'lead:update': { action: 'update', subject: 'lead' },
  'lead:convert': { action: 'update', subject: 'lead' },
  
  // 跟进记录
  'followUp:view': { action: 'read', subject: 'followUp' },
  'followUp:create': { action: 'create', subject: 'followUp' },
  'followUp:update': { action: 'update', subject: 'followUp' },
  
  // 订单管理
  'order:view': { action: 'read', subject: 'order' },
  'order:create': { action: 'create', subject: 'order' },
  'order:update': { action: 'update', subject: 'order' },
  'order:cancel': { action: 'delete', subject: 'order' },
  'order:export': { action: 'export', subject: 'order' },
  
  // 财务管理
  'payment:view': { action: 'read', subject: 'payment' },
  'payment:create': { action: 'create', subject: 'payment' },
  'payment:update': { action: 'update', subject: 'payment' },
  'payment:export': { action: 'export', subject: 'payment' },
  'report:view': { action: 'read', subject: 'report' },
  'report:export': { action: 'export', subject: 'report' },
  
  // 日报管理
  'report:daily:create': { action: 'create', subject: 'report' },
  'report:daily:view': { action: 'read', subject: 'report' },
  'report:daily:update': { action: 'update', subject: 'report' },
  'report:daily:review': { action: 'review', subject: 'report' },
  
  // 消息
  'message:send': { action: 'create', subject: 'message' },
  'message:view': { action: 'read', subject: 'message' },
  'message:delete': { action: 'delete', subject: 'message' },
  
  // 任务
  'task:view': { action: 'read', subject: 'task' },
  'task:create': { action: 'create', subject: 'task' },
  'task:update': { action: 'update', subject: 'task' },
  'task:delete': { action: 'delete', subject: 'task' },
  'task:assign': { action: 'update', subject: 'task' },
  
  // 文件
  'file:upload': { action: 'create', subject: 'file' },
  'file:view': { action: 'read', subject: 'file' },
  'file:download': { action: 'read', subject: 'file' },
  'file:delete': { action: 'delete', subject: 'file' },
  
  // 用户管理(仅管理员)
  'user:view': { action: 'read', subject: 'user' },
  'user:create': { action: 'create', subject: 'user' },
  'user:update': { action: 'update', subject: 'user' },
  'user:delete': { action: 'delete', subject: 'user' },
  'role:view': { action: 'read', subject: 'role' },
  'role:manage': { action: 'update', subject: 'role' },
  
  // 系统设置(仅管理员)
  'setting:view': { action: 'read', subject: 'setting' },
  'setting:update': { action: 'update', subject: 'setting' },
} as const

// 角色权限映射
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  [Role.ADMIN]: [
    // 所有权限
    ...Object.keys(PERMISSIONS),
  ],
  
  [Role.SALES_MANAGER]: [
    // 客户管理 - 查看所有客户
    'customer:view',
    'customer:create',
    'customer:update',
    'customer:export',
    
    // 销售线索
    'lead:view',
    'lead:create',
    'lead:update',
    'lead:convert',
    
    // 跟进记录
    'followUp:view',
    'followUp:create',
    'followUp:update',
    
    // 订单管理 - 查看团队订单
    'order:view',
    'order:create',
    'order:update',
    'order:export',
    
    // 日报 - 审阅下属日报
    'report:daily:view',
    'report:daily:review',
    
    // 消息
    'message:send',
    'message:view',
    
    // 任务
    'task:view',
    'task:create',
    'task:update',
    'task:assign',
    
    // 文件
    'file:upload',
    'file:view',
    'file:download',
  ],
  
  [Role.SALES]: [
    // 客户管理 - 仅查看自己的客户
    'customer:view',
    'customer:create',
    'customer:update',
    
    // 销售线索
    'lead:view',
    'lead:create',
    'lead:update',
    'lead:convert',
    
    // 跟进记录
    'followUp:view',
    'followUp:create',
    'followUp:update',
    
    // 订单管理 - 仅查看自己的订单
    'order:view',
    'order:create',
    'order:update',
    
    // 日报
    'report:daily:create',
    'report:daily:view',
    'report:daily:update',
    
    // 消息
    'message:send',
    'message:view',
    
    // 任务
    'task:view',
    'task:create',
    'task:update',
    
    // 文件
    'file:upload',
    'file:view',
    'file:download',
  ],
  
  [Role.FINANCE]: [
    // 客户管理 - 只读
    'customer:view',
    
    // 订单管理 - 查看所有订单
    'order:view',
    'order:export',
    
    // 财务管理
    'payment:view',
    'payment:create',
    'payment:update',
    'payment:export',
    'report:view',
    'report:export',
    
    // 日报管理 - 查看所有员工日报
    'report:daily:view',
    
    // 消息
    'message:send',
    'message:view',
    
    // 任务
    'task:view',
    'task:create',
    'task:update',
    
    // 文件
    'file:upload',
    'file:view',
    'file:download',
  ],
}

// 创建能力对象
export function defineAbility(permissions: string[]) {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)
  const allPermissionCodes = Object.keys(PERMISSIONS)

  if (allPermissionCodes.every((permissionCode) => permissions.includes(permissionCode))) {
    can('manage', 'all')
  }
  
  permissions.forEach(permissionCode => {
    const permission = PERMISSIONS[permissionCode as keyof typeof PERMISSIONS]
    if (permission) {
      can(permission.action, permission.subject)
    }
  })
  
  return build()
}
