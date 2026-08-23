const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function createComprehensiveTestData() {
  console.log('🚀 开始创建全面测试数据...\n')
  
  // 检查是否已有足够数据
  const customerCount = await prisma.customer.count()
  const orderCount = await prisma.order.count()
  
  console.log(`当前客户数: ${customerCount}`)
  console.log(`当前订单数: ${orderCount}\n`)
  
  if (customerCount > 50 && orderCount > 20) {
    console.log('✅ 已有充足测试数据,跳过创建')
    await prisma.$disconnect()
    return
  }
  
  // 获取或创建用户
  const users = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            name: 'SALES'
          }
        }
      }
    },
    take: 3
  })
  
  if (users.length === 0) {
    console.log('❌ 未找到销售用户,请先创建用户')
    await prisma.$disconnect()
    return
  }
  
  console.log(`使用 ${users.length} 个销售用户\n`)
  
  // 1. 创建客户数据(覆盖不同状态和阶段)
  console.log(' 正在创建客户数据...')
  const customers = []
  const statuses = ['ACTIVE', 'INACTIVE']
  const levels = ['POTENTIAL', 'VIP', 'IMPORTANT', 'NORMAL']
  const sources = ['WEBSITE', 'REFERRAL', 'ADVERTISEMENT', 'EXHIBITION', 'COLD_CALL', 'SOCIAL_MEDIA']
  
  for (let i = 0; i < 60; i++) {
    const userIndex = i % users.length
    const status = i < 45 ? 'ACTIVE' : 'INACTIVE'
    
    const customer = await prisma.customer.create({
      data: {
        name: `测试客户${String(i + 1).padStart(3, '0')}`,
        company: `测试公司${String(i + 1).padStart(3, '0')}有限公司`,
        phone: `138${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
        email: `customer${i + 1}@test.com`,
        salesId: users[userIndex].id,
        status,
        level: levels[i % levels.length],
        source: sources[i % sources.length],
        lastFollowUpAt: new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000),
        notes: `这是测试客户${i + 1}的备注信息`
      }
    })
    
    customers.push(customer)
  }
  
  console.log(`✅ 创建了 ${customers.length} 个客户\n`)
  
  // 2. 创建跟进记录
  console.log('📞 正在创建跟进记录...')
  let followUpCount = 0
  
  for (const customer of customers.slice(0, 40)) {
    const numFollowUps = Math.floor(Math.random() * 5) + 1
    
    for (let j = 0; j < numFollowUps; j++) {
      await prisma.followUp.create({
        data: {
          customerId: customer.id,
          salesId: customer.salesId,
          type: ['PHONE', 'VISIT', 'EMAIL', 'MEETING'][j % 4],
          content: `第${j + 1}次跟进: 与客户沟通产品需求,讨论合作方案`,
          nextFollowUpAt: new Date(Date.now() + (Math.random() * 7 + 1) * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - (numFollowUps - j) * 24 * 60 * 60 * 1000)
        }
      })
      followUpCount++
    }
  }
  
  console.log(`✅ 创建了 ${followUpCount} 条跟进记录\n`)
  
  // 3. 创建订单数据
  console.log('💰 正在创建订单数据...')
  let createdOrderCount = 0
  
  for (const customer of customers.filter(c => c.status === 'ACTIVE').slice(0, 25)) {
    const contractAmount = Math.floor(Math.random() * 200000) + 50000
    const paidAmount = Math.floor(contractAmount * (Math.random() * 0.8 + 0.2))
    
    await prisma.order.create({
      data: {
        orderNo: `ORD-${Date.now()}-${createdOrderCount}`,
        customerId: customer.id,
        salesId: customer.salesId,
        contractNo: `CONTRACT-${Date.now()}-${createdOrderCount}`,
        contractAmount,
        paidAmount,
        unpaidAmount: contractAmount - paidAmount,
        currency: 'CNY',
        signDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + Math.floor(Math.random() * 60 + 30) * 24 * 60 * 60 * 1000),
        status: paidAmount >= contractAmount ? 'COMPLETED' : 'CONFIRMED',
        remarks: `测试订单${orderCount + 1},合同金额¥${contractAmount.toLocaleString()}`
      }
    })
        
    createdOrderCount++
  }
  
  console.log(`✅ 创建了 ${createdOrderCount} 个订单\n`)
  
  // 4. 创建收款记录
  console.log('💵 正在创建收款记录...')
  let paymentCount = 0
  
  const orders = await prisma.order.findMany({
    where: {
      paidAmount: { gt: 0 }
    }
  })
  
  for (const order of orders) {
    const numPayments = Math.floor(Math.random() * 3) + 1
    const amountPerPayment = order.paidAmount / numPayments
    
    for (let k = 0; k < numPayments; k++) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          paymentNo: `PAY-${Date.now()}-${k}`,
          amount: Math.round(amountPerPayment),
          paymentMethod: ['BANK_TRANSFER', 'ALIPAY', 'WECHAT_PAY', 'CHECK'][k % 4],
          paymentDate: new Date(Date.now() - (numPayments - k) * 7 * 24 * 60 * 60 * 1000),
          remarks: `第${k + 1}笔收款`
        }
      })
      paymentCount++
    }
  }
  
  console.log(`✅ 创建了 ${paymentCount} 条收款记录\n`)
  
  // 5. 创建公海池客户
  console.log('🌊 正在创建公海池客户...')
  const publicPoolCustomers = customers.filter(c => c.status === 'INACTIVE').slice(0, 10)
  
  for (const customer of publicPoolCustomers) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        isPublic: true,
        status: 'INACTIVE',
        publicPoolEnteredAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        publicPoolReason: 'RULE_1',
        originalSalesId: customer.salesId,
        publicPoolHistory: [{
          enteredAt: new Date().toISOString(),
          reason: 'RULE_1',
          reasonText: '超过90天未跟进',
          fromSalesId: customer.salesId
        }]
      }
    })
  }
  
  console.log(`✅ 将 ${publicPoolCustomers.length} 个客户移入公海池\n`)
  
  // 6. 创建日报
  console.log('📝 正在创建日报...')
  let reportCount = 0
  
  for (const user of users) {
    for (let d = 0; d < 7; d++) {
      await prisma.dailyReport.create({
        data: {
          userId: user.id,
          date: new Date(Date.now() - d * 24 * 60 * 60 * 1000),
          workContent: `今日工作内容:\n1. 跟进客户${d + 1}\n2. 拜访新客户\n3. 整理销售资料`,
          tomorrowPlan: `明日计划:\n1. 继续跟进意向客户\n2. 准备报价方案\n3. 参加部门会议`,
          issues: '暂无特殊问题',
          status: 'SUBMITTED'
        }
      })
      reportCount++
    }
  }
  
  console.log(`✅ 创建了 ${reportCount} 条日报\n`)
  
  // 统计汇总
  console.log('\n' + '='.repeat(50))
  console.log('📊 测试数据创建完成!')
  console.log('='.repeat(50))
  
  const finalStats = {
    customers: await prisma.customer.count(),
    activeCustomers: await prisma.customer.count({ where: { isPublic: false, status: 'ACTIVE' } }),
    publicPoolCustomers: await prisma.customer.count({ where: { isPublic: true } }),
    orders: await prisma.order.count(),
    totalContractAmount: (await prisma.order.aggregate({ _sum: { contractAmount: true } }))._sum.contractAmount || 0,
    followUps: await prisma.followUp.count(),
    payments: await prisma.payment.count(),
    reports: await prisma.dailyReport.count()
  }
  
  console.log(`\n 客户总数: ${finalStats.customers}`)
  console.log(`   ├─ 活跃客户: ${finalStats.activeCustomers}`)
  console.log(`   └─ 公海池: ${finalStats.publicPoolCustomers}`)
  console.log(`\n💰 订单总数: ${finalStats.orders}`)
  console.log(`   └─ 合同总金额: ¥${Number(finalStats.totalContractAmount).toLocaleString()}`)
  console.log(`\n📞 跟进记录: ${finalStats.followUps}`)
  console.log(`💵 收款记录: ${finalStats.payments}`)
  console.log(`📝 日报数量: ${finalStats.reports}`)
  console.log('\n' + '='.repeat(50))
  
  await prisma.$disconnect()
}

createComprehensiveTestData().catch(console.error)
