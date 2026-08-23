const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function createTestData() {
  console.log('开始创建测试数据...')
  
  // 检查是否已有数据
  const customerCount = await prisma.customer.count()
  const orderCount = await prisma.order.count()
  
  console.log(`当前客户数: ${customerCount}`)
  console.log(`当前订单数: ${orderCount}`)
  
  if (customerCount > 10 && orderCount > 5) {
    console.log('已有足够测试数据,跳过创建')
    await prisma.$disconnect()
    return
  }
  
  // 获取第一个销售用户
  const salesUser = await prisma.user.findFirst({
    where: {
      roles: {
        some: {
          role: {
            name: 'SALES'
          }
        }
      }
    }
  })
  
  if (!salesUser) {
    console.log('未找到销售用户,请先创建用户')
    await prisma.$disconnect()
    return
  }
  
  console.log(`使用销售用户: ${salesUser.realName} (${salesUser.id})`)
  
  // 创建测试客户
  const customers = []
  const now = new Date()
  
  for (let i = 1; i <= 20; i++) {
    const createdAt = new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000)
    const lastFollowUpAt = Math.random() > 0.3 
      ? new Date(now.getTime() - Math.random() * 10 * 24 * 60 * 60 * 1000)
      : null
    
    const customer = await prisma.customer.create({
      data: {
        name: `测试客户${i}`,
        company: `测试公司${i}`,
        phone: `138001380${String(i).padStart(2, '0')}`,
        email: `customer${i}@test.com`,
        salesId: salesUser.id,
        status: 'ACTIVE',
        level: ['POTENTIAL', 'NORMAL', 'IMPORTANT', 'VIP'][Math.floor(Math.random() * 4)],
        createdAt,
        lastFollowUpAt,
        isPublic: false
      }
    })
    
    customers.push(customer)
    console.log(`创建客户: ${customer.name}`)
  }
  
  // 创建测试订单
  for (let i = 0; i < 15; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)]
    const amount = Math.floor(Math.random() * 100000) + 10000
    const createdAt = new Date(now.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000)
    
    await prisma.order.create({
      data: {
        customerId: customer.id,
        salesId: salesUser.id,
        amount,
        status: ['QUOTATION', 'PENDING', 'COMPLETED'][Math.floor(Math.random() * 3)],
        createdAt
      }
    })
    
    console.log(`创建订单: ¥${amount.toLocaleString()} - ${customer.name}`)
  }
  
  console.log('\n✅ 测试数据创建完成!')
  console.log(`- 客户数: ${customers.length}`)
  console.log(`- 订单数: 15`)
  
  await prisma.$disconnect()
}

createTestData().catch(console.error)
