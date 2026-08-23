import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('开始种子数据...')

  // 创建角色
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      displayName: '管理员',
      description: '系统管理员,拥有所有权限',
    },
  })

  const salesManagerRole = await prisma.role.upsert({
    where: { name: 'sales_manager' },
    update: {},
    create: {
      name: 'sales_manager',
      displayName: '销售主管',
      description: '销售团队主管,可管理团队和审阅日报',
    },
  })

  const salesRole = await prisma.role.upsert({
    where: { name: 'sales' },
    update: {},
    create: {
      name: 'sales',
      displayName: '普通销售',
      description: '普通销售人员,仅能管理自己的客户',
    },
  })

  const financeRole = await prisma.role.upsert({
    where: { name: 'finance' },
    update: {},
    create: {
      name: 'finance',
      displayName: '财务',
      description: '财务人员,负责订单收款和财务报表',
    },
  })

  console.log('角色创建完成')

  // 创建权限
  const permissions = [
    // 客户管理
    { code: 'customer:view', name: '查看客户', module: 'customer' },
    { code: 'customer:create', name: '创建客户', module: 'customer' },
    { code: 'customer:update', name: '更新客户', module: 'customer' },
    { code: 'customer:delete', name: '删除客户', module: 'customer' },
    { code: 'customer:export', name: '导出客户', module: 'customer' },
    
    // 销售线索
    { code: 'lead:view', name: '查看线索', module: 'lead' },
    { code: 'lead:create', name: '创建线索', module: 'lead' },
    { code: 'lead:update', name: '更新线索', module: 'lead' },
    { code: 'lead:convert', name: '转化线索', module: 'lead' },
    
    // 跟进记录
    { code: 'followUp:view', name: '查看跟进', module: 'followUp' },
    { code: 'followUp:create', name: '创建跟进', module: 'followUp' },
    { code: 'followUp:update', name: '更新跟进', module: 'followUp' },
    
    // 订单管理
    { code: 'order:view', name: '查看订单', module: 'order' },
    { code: 'order:create', name: '创建订单', module: 'order' },
    { code: 'order:update', name: '更新订单', module: 'order' },
    { code: 'order:cancel', name: '取消订单', module: 'order' },
    { code: 'order:export', name: '导出订单', module: 'order' },
    
    // 财务管理
    { code: 'payment:view', name: '查看收款', module: 'payment' },
    { code: 'payment:create', name: '创建收款', module: 'payment' },
    { code: 'payment:update', name: '更新收款', module: 'payment' },
    { code: 'payment:export', name: '导出收款', module: 'payment' },
    { code: 'report:view', name: '查看报表', module: 'report' },
    { code: 'report:export', name: '导出报表', module: 'report' },
    
    // 日报管理
    { code: 'report:daily:create', name: '创建日报', module: 'report' },
    { code: 'report:daily:view', name: '查看日报', module: 'report' },
    { code: 'report:daily:update', name: '更新日报', module: 'report' },
    { code: 'report:daily:review', name: '审阅日报', module: 'report' },
    
    // 消息
    { code: 'message:send', name: '发送消息', module: 'message' },
    { code: 'message:view', name: '查看消息', module: 'message' },
    { code: 'message:delete', name: '删除消息', module: 'message' },
    
    // 任务
    { code: 'task:view', name: '查看任务', module: 'task' },
    { code: 'task:create', name: '创建任务', module: 'task' },
    { code: 'task:update', name: '更新任务', module: 'task' },
    { code: 'task:delete', name: '删除任务', module: 'task' },
    { code: 'task:assign', name: '分配任务', module: 'task' },
    
    // 文件
    { code: 'file:upload', name: '上传文件', module: 'file' },
    { code: 'file:view', name: '查看文件', module: 'file' },
    { code: 'file:download', name: '下载文件', module: 'file' },
    { code: 'file:delete', name: '删除文件', module: 'file' },
    
    // 用户管理
    { code: 'user:view', name: '查看用户', module: 'user' },
    { code: 'user:create', name: '创建用户', module: 'user' },
    { code: 'user:update', name: '更新用户', module: 'user' },
    { code: 'user:delete', name: '删除用户', module: 'user' },
    { code: 'role:manage', name: '管理角色', module: 'role' },
    
    // 系统设置
    { code: 'setting:view', name: '查看设置', module: 'setting' },
    { code: 'setting:update', name: '更新设置', module: 'setting' },
  ]

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    })
  }

  console.log('权限创建完成')

  // 为角色分配权限
  const allPermissions = await prisma.permission.findMany()
  
  // 管理员 - 所有权限
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        }
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    })
  }

  // 销售主管权限
  const salesManagerPerms = [
    'customer:view', 'customer:create', 'customer:update', 'customer:export',
    'lead:view', 'lead:create', 'lead:update', 'lead:convert',
    'followUp:view', 'followUp:create', 'followUp:update',
    'order:view', 'order:create', 'order:update', 'order:export',
    'report:daily:view', 'report:daily:review',
    'message:send', 'message:view',
    'task:view', 'task:create', 'task:update', 'task:assign',
    'file:upload', 'file:view', 'file:download',
  ]

  for (const permCode of salesManagerPerms) {
    const perm = allPermissions.find(p => p.code === permCode)
    if (perm) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: salesManagerRole.id,
            permissionId: perm.id,
          }
        },
        update: {},
        create: {
          roleId: salesManagerRole.id,
          permissionId: perm.id,
        },
      })
    }
  }

  // 普通销售权限
  const salesPerms = [
    'customer:view', 'customer:create', 'customer:update',
    'lead:view', 'lead:create', 'lead:update', 'lead:convert',
    'followUp:view', 'followUp:create', 'followUp:update',
    'order:view', 'order:create', 'order:update',
    'report:daily:create', 'report:daily:view', 'report:daily:update',
    'message:send', 'message:view',
    'task:view', 'task:create', 'task:update',
    'file:upload', 'file:view', 'file:download',
  ]

  for (const permCode of salesPerms) {
    const perm = allPermissions.find(p => p.code === permCode)
    if (perm) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: salesRole.id,
            permissionId: perm.id,
          }
        },
        update: {},
        create: {
          roleId: salesRole.id,
          permissionId: perm.id,
        },
      })
    }
  }

  // 财务权限
  const financePerms = [
    'customer:view',
    'order:view', 'order:export',
    'payment:view', 'payment:create', 'payment:update', 'payment:export',
    'report:view', 'report:export',
    'message:send', 'message:view',
    'task:view', 'task:create', 'task:update',
    'file:upload', 'file:view', 'file:download',
  ]

  for (const permCode of financePerms) {
    const perm = allPermissions.find(p => p.code === permCode)
    if (perm) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: financeRole.id,
            permissionId: perm.id,
          }
        },
        update: {},
        create: {
          roleId: financeRole.id,
          permissionId: perm.id,
        },
      })
    }
  }

  console.log('角色权限分配完成')

  // 创建示例用户
  const hashedPassword = await bcrypt.hash('123456', 10)

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@crm.com',
      password: hashedPassword,
      realName: '系统管理员',
      phone: '13800138000',
      department: '技术部',
      position: '管理员',
      status: 'ACTIVE',
    },
  })

  // 为管理员用户分配admin角色
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  })

  console.log('示例用户创建完成')
  console.log('管理员账号已创建: admin')
  console.log('种子数据完成!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
