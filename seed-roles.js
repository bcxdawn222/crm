const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seedRoles() {
  console.log('🌱 Seeding roles and permissions...\n')
  
  try {
    // 创建角色
    const roles = [
      {
        name: 'admin',
        displayName: '管理员',
        description: '系统管理员,拥有所有权限'
      },
      {
        name: 'sales_manager',
        displayName: '销售主管',
        description: '销售团队主管,可查看自己和下属的数据'
      },
      {
        name: 'sales',
        displayName: '销售代表',
        description: '销售人员,只能查看自己的数据'
      },
      {
        name: 'finance',
        displayName: '财务专员',
        description: '财务人员,可查看所有订单和财务数据'
      }
    ]
    
    console.log('Creating roles...')
    for (const roleData of roles) {
      await prisma.role.upsert({
        where: { name: roleData.name },
        update: {},
        create: roleData
      })
      console.log(`   ✓ ${roleData.displayName} (${roleData.name})`)
    }
    
    // 创建权限
    const permissions = [
      // 客户管理
      { code: 'customer:view', name: '查看客户', module: 'customer' },
      { code: 'customer:create', name: '创建客户', module: 'customer' },
      { code: 'customer:update', name: '编辑客户', module: 'customer' },
      { code: 'customer:delete', name: '删除客户', module: 'customer' },
      { code: 'customer:export', name: '导出客户', module: 'customer' },
      
      // 销售线索
      { code: 'lead:view', name: '查看线索', module: 'lead' },
      { code: 'lead:create', name: '创建线索', module: 'lead' },
      { code: 'lead:update', name: '编辑线索', module: 'lead' },
      { code: 'lead:convert', name: '转化线索', module: 'lead' },
      
      // 跟进记录
      { code: 'followUp:view', name: '查看跟进', module: 'followUp' },
      { code: 'followUp:create', name: '创建跟进', module: 'followUp' },
      { code: 'followUp:update', name: '编辑跟进', module: 'followUp' },
      
      // 订单管理
      { code: 'order:view', name: '查看订单', module: 'order' },
      { code: 'order:create', name: '创建订单', module: 'order' },
      { code: 'order:update', name: '编辑订单', module: 'order' },
      { code: 'order:cancel', name: '取消订单', module: 'order' },
      { code: 'order:export', name: '导出订单', module: 'order' },
      
      // 财务管理
      { code: 'payment:view', name: '查看收款', module: 'payment' },
      { code: 'payment:create', name: '创建收款', module: 'payment' },
      { code: 'payment:update', name: '编辑收款', module: 'payment' },
      { code: 'payment:export', name: '导出收款', module: 'payment' },
      { code: 'report:view', name: '查看报表', module: 'report' },
      { code: 'report:export', name: '导出报表', module: 'report' },
      
      // 日报管理
      { code: 'report:daily:create', name: '创建日报', module: 'report' },
      { code: 'report:daily:view', name: '查看日报', module: 'report' },
      { code: 'report:daily:update', name: '编辑日报', module: 'report' },
      { code: 'report:daily:review', name: '审阅日报', module: 'report' },
      
      // 消息
      { code: 'message:send', name: '发送消息', module: 'message' },
      { code: 'message:view', name: '查看消息', module: 'message' },
      { code: 'message:delete', name: '删除消息', module: 'message' },
      
      // 任务
      { code: 'task:view', name: '查看任务', module: 'task' },
      { code: 'task:create', name: '创建任务', module: 'task' },
      { code: 'task:update', name: '编辑任务', module: 'task' },
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
      { code: 'user:update', name: '编辑用户', module: 'user' },
      { code: 'user:delete', name: '删除用户', module: 'user' },
      { code: 'role:view', name: '查看角色', module: 'role' },
      { code: 'role:manage', name: '管理角色', module: 'role' },
      
      // 系统设置
      { code: 'setting:view', name: '查看设置', module: 'setting' },
      { code: 'setting:update', name: '修改设置', module: 'setting' },
    ]
    
    console.log('\nCreating permissions...')
    for (const permData of permissions) {
      await prisma.permission.upsert({
        where: { code: permData.code },
        update: {},
        create: permData
      })
    }
    console.log(`   ✓ Created ${permissions.length} permissions`)
    
    // 为每个角色分配权限
    const rolePermissions = {
      admin: permissions.map(p => p.code), // Admin拥有所有权限
      
      sales_manager: [
        'customer:view', 'customer:create', 'customer:update', 'customer:export',
        'lead:view', 'lead:create', 'lead:update', 'lead:convert',
        'followUp:view', 'followUp:create', 'followUp:update',
        'order:view', 'order:create', 'order:update', 'order:export',
        'report:daily:view', 'report:daily:review',
        'message:send', 'message:view',
        'task:view', 'task:create', 'task:update', 'task:assign',
        'file:upload', 'file:view', 'file:download',
      ],
      
      sales: [
        'customer:view', 'customer:create', 'customer:update',
        'lead:view', 'lead:create', 'lead:update', 'lead:convert',
        'followUp:view', 'followUp:create', 'followUp:update',
        'order:view', 'order:create', 'order:update',
        'report:daily:create', 'report:daily:view', 'report:daily:update',
        'message:send', 'message:view',
        'task:view', 'task:update',
        'file:upload', 'file:view', 'file:download',
      ],
      
      finance: [
        'customer:view',
        'order:view', 'order:export',
        'payment:view', 'payment:create', 'payment:update', 'payment:export',
        'report:view', 'report:export',
        'report:daily:view',
        'message:send', 'message:view',
        'task:view', 'task:create', 'task:update',
        'file:upload', 'file:view', 'file:download',
      ]
    }
    
    console.log('\nAssigning permissions to roles...')
    for (const [roleName, permCodes] of Object.entries(rolePermissions)) {
      const role = await prisma.role.findUnique({ where: { name: roleName } })
      if (!role) continue
      
      for (const permCode of permCodes) {
        const permission = await prisma.permission.findUnique({ where: { code: permCode } })
        if (!permission) continue
        
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id
            }
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id
          }
        })
      }
      console.log(`   ✓ ${role.displayName}: ${permCodes.length} permissions`)
    }
    
    // 为用户分配角色
    console.log('\nAssigning roles to users...')
    const userRoles = {
      admin: ['admin'],
      manager: ['sales_manager'],
      sales: ['sales'],
      finance: ['finance']
    }
    
    for (const [username, roleNames] of Object.entries(userRoles)) {
      const user = await prisma.user.findUnique({ where: { username } })
      if (!user) {
        console.log(`   ⚠ User '${username}' not found, skipping`)
        continue
      }
      
      for (const roleName of roleNames) {
        const role = await prisma.role.findUnique({ where: { name: roleName } })
        if (!role) continue
        
        await prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId: role.id
            }
          },
          update: {},
          create: {
            userId: user.id,
            roleId: role.id
          }
        })
      }
      console.log(`   ✓ ${user.realName} (${username}): ${roleNames.join(', ')}`)
    }
    
    console.log('\n✅ Roles and permissions seeded successfully!\n')
    
    // 显示总结
    console.log('📊 Summary:')
    const allRoles = await prisma.role.findMany({
      include: {
        _count: { select: { users: true, permissions: true } }
      }
    })
    
    console.log('\nRoles in database:')
    for (const role of allRoles) {
      console.log(`   • ${role.displayName} (${role.name})`)
      console.log(`     - Users: ${role._count.users}`)
      console.log(`     - Permissions: ${role._count.permissions}`)
    }
    
  } catch (error) {
    console.error(' Error seeding roles:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedRoles()
