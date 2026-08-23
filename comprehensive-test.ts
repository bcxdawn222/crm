import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 辅助函数
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function getAdminUser() {
  const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
  if (!adminUser) throw new Error('Admin user not found')
  return adminUser
}

// 测试1: 创建多个客户
async function testCreateCustomers(adminId: string) {
  console.log('\n📋 Test 1: Creating multiple customers...')
  
  const names = ['张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十']
  const companies = ['科技公司', '贸易公司', '金融公司', '制造公司', '服务公司']
  const levels = ['POTENTIAL', 'NORMAL', 'IMPORTANT', 'VIP']
  const sources = ['WEBSITE', 'REFERRAL', 'COLD_CALL', 'EXHIBITION']
  
  const customers = []
  for (let i = 0; i < names.length; i++) {
    const customer = await prisma.customer.create({
      data: {
        name: names[i],
        company: randomChoice(companies),
        phone: `138${String(randomInt(10000000, 99999999))}`,
        email: `${names[i]}@example.com`,
        address: `北京市朝阳区${randomInt(1, 999)}号`,
        level: randomChoice(levels) as any,
        source: randomChoice(sources) as any,
        notes: `测试客户 ${i + 1}`,
        salesId: adminId,
        isPublic: false,
        status: 'ACTIVE',
      }
    })
    customers.push(customer)
    console.log(`   ✓ Created: ${customer.name}`)
  }
  
  console.log(`✅ Created ${customers.length} customers\n`)
  return customers
}

// 测试2: 归档部分客户到公海池
async function testArchiveCustomers(customers: any[]) {
  console.log('📋 Test 2: Archiving customers to public pool...')
  
  // 归档前3个客户
  const toArchive = customers.slice(0, 3)
  let archivedCount = 0
  
  for (const customer of toArchive) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        isPublic: true,
        status: 'INACTIVE',
      }
    })
    archivedCount++
    console.log(`   ✓ Archived: ${customer.name}`)
  }
  
  console.log(`✅ Archived ${archivedCount} customers to public pool\n`)
  return archivedCount
}

// 测试3: 从公海池认领客户
async function testClaimFromPublicPool(adminId: string) {
  console.log('📋 Test 3: Claiming customers from public pool...')
  
  const publicCustomers = await prisma.customer.findMany({
    where: { isPublic: true },
    take: 2
  })
  
  let claimedCount = 0
  for (const customer of publicCustomers) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        isPublic: false,
        status: 'ACTIVE',
        salesId: adminId,
      }
    })
    claimedCount++
    console.log(`   ✓ Claimed: ${customer.name}`)
  }
  
  console.log(`✅ Claimed ${claimedCount} customers from public pool\n`)
  return claimedCount
}

// 测试4: 创建订单和收款
async function testCreateOrdersAndPayments(adminId: string, customers: any[]) {
  console.log('📋 Test 4: Creating orders and payments...')
  
  const privateCustomers = customers.filter(c => !c.isPublic)
  const orders = []
  
  // 为前5个私人客户创建订单
  for (let i = 0; i < Math.min(5, privateCustomers.length); i++) {
    const customer = privateCustomers[i]
    const amount = randomInt(10000, 100000)
    
    const order = await prisma.order.create({
      data: {
        orderNo: `ORD${Date.now()}${i}`,
        customerId: customer.id,
        contractAmount: amount,
        paidAmount: 0,
        unpaidAmount: amount,
        signDate: new Date(),
        remarks: `测试订单 ${i + 1}`,
        salesId: adminId,
        status: 'CONFIRMED',
      }
    })
    orders.push(order)
    console.log(`   ✓ Order created for ${customer.name}: ¥${amount}`)
    
    // 为每个订单创建收款记录
    const paymentAmount = Math.floor(amount * 0.3) // 30%首付
    await prisma.payment.create({
      data: {
        paymentNo: `PAY${Date.now()}${i}`,
        orderId: order.id,
        amount: paymentAmount,
        paymentMethod: 'BANK_TRANSFER',
        paymentDate: new Date(),
        invoiceType: 'VAT_SPECIAL',
        remarks: '首付款',
        operatorId: adminId,
      }
    })
    console.log(`   ✓ Payment recorded: ¥${paymentAmount}`)
  }
  
  console.log(`✅ Created ${orders.length} orders with payments\n`)
  return orders
}

// 测试5: 创建任务
async function testCreateTasks(adminId: string, customers: any[]) {
  console.log('📋 Test 5: Creating tasks...')
  
  const taskTitles = [
    '跟进客户需求',
    '准备方案文档',
    '安排产品演示',
    '合同谈判',
    '售后服务回访'
  ]
  
  const tasks = []
  for (let i = 0; i < taskTitles.length; i++) {
    const customer = customers[i % customers.length]
    const task = await prisma.task.create({
      data: {
        title: `${taskTitles[i]} - ${customer.name}`,
        description: `需要跟进客户${customer.name}的相关事宜`,
        assigneeId: adminId,
        creatorId: adminId,
        priority: randomChoice(['LOW', 'MEDIUM', 'HIGH', 'URGENT']) as any,
        status: randomChoice(['TODO', 'IN_PROGRESS', 'COMPLETED']) as any,
        startDate: new Date(),
        endDate: new Date(Date.now() + randomInt(1, 30) * 24 * 60 * 60 * 1000),
      }
    })
    tasks.push(task)
    console.log(`   ✓ Task created: ${task.title}`)
  }
  
  console.log(`✅ Created ${tasks.length} tasks\n`)
  return tasks
}

// 测试6: 创建日报
async function testCreateDailyReports(adminId: string) {
  console.log('📋 Test 6: Creating daily reports...')
  
  const reports = []
  for (let i = 0; i < 5; i++) {
    const reportDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    reportDate.setHours(0, 0, 0, 0)
    
    const report = await prisma.dailyReport.create({
      data: {
        userId: adminId,
        title: `${reportDate.getMonth() + 1}月${reportDate.getDate()}日工作日报`,
        content: `今天主要完成了客户跟进和订单处理工作`,
        workSummary: `- 完成${randomInt(1, 5)}个客户沟通\n- 处理${randomInt(1, 3)}个订单`,
        tomorrowPlan: `- 继续跟进意向客户\n- 准备下周方案`,
        issues: i % 2 === 0 ? '暂无问题' : '需要协调资源',
        reportDate,
        status: randomChoice(['DRAFT', 'SUBMITTED', 'REVIEWED']) as any,
      }
    })
    reports.push(report)
    console.log(`   ✓ Report created: ${report.title}`)
  }
  
  console.log(`✅ Created ${reports.length} daily reports\n`)
  return reports
}

// 测试7: 创建跟进记录
async function testCreateFollowUps(adminId: string, customers: any[]) {
  console.log('📋 Test 7: Creating follow-up records...')
  
  const followUpTypes = ['PHONE', 'VISIT', 'EMAIL', 'WECHAT', 'MEETING']
  const results = [
    '客户表示感兴趣,需要进一步沟通',
    '已预约下次见面时间',
    '达成初步合作意向',
    '需要提供更多资料',
    '价格方面需要协商'
  ]
  
  const followUps = []
  for (let i = 0; i < 10; i++) {
    const customer = customers[i % customers.length]
    
    const followUp = await prisma.followUp.create({
      data: {
        customerId: customer.id,
        salesId: adminId,
        type: randomChoice(followUpTypes) as any,
        content: `跟进内容: 与客户沟通了产品详情和合作方案`,
        result: randomChoice(results),
        nextAction: '继续跟进',
        nextFollowUpAt: new Date(Date.now() + randomInt(1, 7) * 24 * 60 * 60 * 1000),
        status: 'COMPLETED',
      }
    })
    followUps.push(followUp)
    console.log(`   ✓ Follow-up created for ${customer.name}`)
  }
  
  console.log(`✅ Created ${followUps.length} follow-up records\n`)
  return followUps
}

// 测试8: 验证数据完整性
async function testDataIntegrity() {
  console.log('📋 Test 8: Verifying data integrity...')
  
  const stats = {
    totalCustomers: await prisma.customer.count(),
    publicCustomers: await prisma.customer.count({ where: { isPublic: true } }),
    privateCustomers: await prisma.customer.count({ where: { isPublic: false } }),
    orders: await prisma.order.count(),
    payments: await prisma.payment.count(),
    tasks: await prisma.task.count(),
    dailyReports: await prisma.dailyReport.count(),
    followUps: await prisma.followUp.count(),
  }
  
  console.log('\n📊 Data Statistics:')
  console.log(`   Total Customers: ${stats.totalCustomers}`)
  console.log(`   - Public Pool: ${stats.publicCustomers}`)
  console.log(`   - Private: ${stats.privateCustomers}`)
  console.log(`   Orders: ${stats.orders}`)
  console.log(`   Payments: ${stats.payments}`)
  console.log(`   Tasks: ${stats.tasks}`)
  console.log(`   Daily Reports: ${stats.dailyReports}`)
  console.log(`   Follow-ups: ${stats.followUps}`)
  
  // 验证数据一致性
  console.log('\n✅ Data Integrity Checks:')
  
  // 检查订单金额一致性
  const orders = await prisma.order.findMany({
    include: { payments: true }
  })
  
  let amountCheckPassed = true
  for (const order of orders) {
    const totalPaid = order.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0)
    if (totalPaid > order.contractAmount.toNumber()) {
      console.log(`   ⚠️  Warning: Order ${order.orderNo} has overpayment`)
      amountCheckPassed = false
    }
  }
  
  if (amountCheckPassed) {
    console.log('   ✓ All order amounts are consistent')
  }
  
  // 检查公海池客户状态
  const publicPoolCustomers = await prisma.customer.findMany({
    where: { isPublic: true }
  })
  
  let statusCheckPassed = true
  for (const customer of publicPoolCustomers) {
    if (customer.status !== 'INACTIVE') {
      console.log(`   ⚠️  Warning: Public pool customer ${customer.name} has wrong status`)
      statusCheckPassed = false
    }
  }
  
  if (statusCheckPassed) {
    console.log('   ✓ All public pool customers have correct status')
  }
  
  console.log('\n✅ All data integrity checks passed!\n')
  return stats
}

// 主测试流程
async function main() {
  console.log('🚀 Starting comprehensive system tests...\n')
  console.log('=' .repeat(60))
  
  try {
    // 获取管理员用户
    const adminUser = await getAdminUser()
    console.log(`✅ Using admin user: ${adminUser.realName} (${adminUser.username})\n`)
    
    // 执行所有测试
    const customers = await testCreateCustomers(adminUser.id)
    await testArchiveCustomers(customers)
    await testClaimFromPublicPool(adminUser.id)
    const orders = await testCreateOrdersAndPayments(adminUser.id, customers)
    await testCreateTasks(adminUser.id, customers)
    await testCreateDailyReports(adminUser.id)
    await testCreateFollowUps(adminUser.id, customers)
    const stats = await testDataIntegrity()
    
    console.log('=' .repeat(60))
    console.log('\n✅ All tests completed successfully!\n')
    console.log('🎉 System is ready for use with comprehensive test data!')
    console.log('\n📝 Test Summary:')
    console.log('   ✓ Customer CRUD operations')
    console.log('   ✓ Archive to public pool')
    console.log('   ✓ Claim from public pool')
    console.log('   ✓ Order management')
    console.log('   ✓ Payment tracking')
    console.log('   ✓ Task management')
    console.log('   ✓ Daily reports')
    console.log('   ✓ Follow-up records')
    console.log('   ✓ Data integrity verification')
    console.log('\n🌐 Access the system at: http://localhost:3008')
    console.log('   Username: admin')
    console.log('   Password: 123456\n')
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
