import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking database data...\n')
  
  // 检查客户数据
  const customerCount = await prisma.customer.count()
  console.log(`📊 Customers: ${customerCount}`)
  
  // 获取前5个客户
  const customers = await prisma.customer.findMany({
    take: 5,
    select: {
      id: true,
      name: true,
      company: true,
      phone: true,
      email: true,
      level: true,
      source: true,
      status: true,
      salesId: true,
    }
  })
  
  console.log('\n Sample Customers:')
  customers.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name} - ${c.company || '无公司'} - ${c.phone} - Level: ${c.level} - Source: ${c.source}`)
  })
  
  // 检查订单数据
  const orderCount = await prisma.order.count()
  console.log(`\n📊 Orders: ${orderCount}`)
  
  // 检查收款数据
  const paymentCount = await prisma.payment.count()
  console.log(`📊 Payments: ${paymentCount}`)
  
  // 检查日报数据
  const reportCount = await prisma.dailyReport.count()
  console.log(`📝 Daily Reports: ${reportCount}`)
  
  // 检查任务数据
  const taskCount = await prisma.task.count()
  console.log(`✅ Tasks: ${taskCount}`)
  
  // 检查admin用户
  const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
  if (adminUser) {
    console.log(`\n✅ Admin user exists: ${adminUser.id}`)
    
    // 检查是否有角色和权限
    const roles = await prisma.userRole.findMany({
      where: { userId: adminUser.id },
      include: { role: true }
    })
    
    console.log(` Admin roles: ${roles.map(r => r.role.name).join(', ')}`)
    
    if (roles.length > 0) {
      const permissions = await prisma.permission.findMany({
        where: { id: roles[0].roleId },
        select: { code: true }
      })
      console.log(`🔐 Permissions count: ${permissions.length}`)
    }
  } else {
    console.log('\n Admin user NOT found!')
  }
  
  console.log('\n✅ Database check completed!')
  
  await prisma.$disconnect()
}

main().catch(console.error)
