import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始创建测试订单数据...')

  // 获取第一个客户
  const customer = await prisma.customer.findFirst()
  
  if (!customer) {
    console.error('未找到客户数据')
    return
  }

  // 获取admin用户
  const salesUser = await prisma.user.findFirst({
    where: { username: 'admin' }
  })

  if (!salesUser) {
    console.error('未找到用户')
    return
  }

  console.log(`使用客户: ${customer.name} (${customer.id})`)
  console.log(`使用销售: ${salesUser.realName} (${salesUser.id})`)

  // 创建测试订单
  const orders = [
    {
      orderNo: `ORD${new Date().getFullYear()}0101001`,
      customerId: customer.id,
      salesId: salesUser.id,
      contractNo: 'HT20240101',
      contractAmount: 50000.00,
      paidAmount: 20000.00,
      unpaidAmount: 30000.00,
      currency: 'CNY',
      status: 'PROCESSING' as any,
      signDate: new Date('2024-01-15'),
      deliveryDate: new Date('2024-03-15'),
      remarks: '第一批订单,需要按时交付',
    },
    {
      orderNo: `ORD${new Date().getFullYear()}0102002`,
      customerId: customer.id,
      salesId: salesUser.id,
      contractNo: 'HT20240201',
      contractAmount: 80000.00,
      paidAmount: 80000.00,
      unpaidAmount: 0,
      currency: 'CNY',
      status: 'COMPLETED' as any,
      signDate: new Date('2024-02-10'),
      deliveryDate: new Date('2024-04-10'),
      remarks: '已全额付款',
    },
    {
      orderNo: `ORD${new Date().getFullYear()}0103003`,
      customerId: customer.id,
      salesId: salesUser.id,
      contractNo: 'HT20240301',
      contractAmount: 120000.00,
      paidAmount: 0,
      unpaidAmount: 120000.00,
      currency: 'CNY',
      status: 'PENDING' as any,
      signDate: new Date('2024-03-05'),
      deliveryDate: new Date('2024-05-05'),
      remarks: '待付款',
    },
  ]

  for (const orderData of orders) {
    try {
      const order = await prisma.order.create({
        data: orderData,
      })
      console.log(`✓ 创建订单: ${order.orderNo}`)
    } catch (error: any) {
      console.log(`✗ 订单已存在: ${orderData.orderNo}`)
    }
  }

  console.log('\n测试订单数据创建完成!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
