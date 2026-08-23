import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 辅助函数:随机选择
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// 辅助函数:生成随机数
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 获取admin用户
async function getAdminUser() {
  const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
  if (!adminUser) throw new Error('Admin user not found')
  return adminUser
}

// 生成客户数据
async function generateCustomers(adminId: string, count: number = 20) {
  console.log(`\n📋 Generating ${count} customers...`)
  
  const names = ['李明', '王芳', '张伟', '刘洋', '陈静', '杨强', '赵敏', '黄磊', '周杰', '吴秀英', 
                 '徐涛', '孙丽', '朱峰', '马兰', '胡军', '郭霞', '何勇', '高燕', '林涛', '罗芳']
  const companies = ['科技有限公司', '贸易发展公司', '金融服务公司', '制造企业', '咨询公司', 
                     '教育机构', '医疗集团', '建筑公司', '物流公司', '餐饮连锁']
  const levels = ['POTENTIAL', 'NORMAL', 'IMPORTANT', 'VIP']
  const sources = ['WEBSITE', 'REFERRAL', 'ADVERTISEMENT', 'EXHIBITION', 'COLD_CALL', 'SOCIAL_MEDIA', 'OTHER']
  
  const customers = []
  for (let i = 0; i < count; i++) {
    const name = `${names[i % names.length]}${i > names.length ? i : ''}`
    const customer = await prisma.customer.create({
      data: {
        name,
        company: randomChoice(companies),
        phone: `138${String(randomInt(10000000, 99999999))}`,
        email: `${name.toLowerCase().replace(/\s/g, '.')}@example.com`,
        address: `北京市朝阳区建国路${randomInt(1, 999)}号`,
        level: randomChoice(levels) as any,
        source: randomChoice(sources) as any,
        notes: `这是${name}的备注信息`,
        salesId: adminId,
        status: 'ACTIVE',
      }
    })
    customers.push(customer)
  }
  
  console.log(`✅ Created ${customers.length} customers`)
  return customers
}

// 生成订单数据
async function generateOrders(adminId: string, customers: any[], count: number = 15) {
  console.log(`\n📦 Generating ${count} orders...`)
  
  const statuses = ['PENDING', 'CONFIRMED', 'DELIVERING', 'COMPLETED']
  const orders = []
  
  for (let i = 0; i < count; i++) {
    const customer = randomChoice(customers)
    const amount = randomInt(10000, 500000)
    const orderNo = `ORD${Date.now()}${i}`
    
    const order = await prisma.order.create({
      data: {
        orderNo,
        customerId: customer.id,
        contractAmount: amount,
        paidAmount: 0,
        unpaidAmount: amount,
        signDate: new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000),
        remarks: `订单备注 ${i + 1}`,
        salesId: adminId,
        status: randomChoice(statuses) as any,
      }
    })
    orders.push(order)
  }
  
  console.log(`✅ Created ${orders.length} orders`)
  return orders
}

// 生成收款记录
async function generatePayments(adminId: string, orders: any[], count: number = 10) {
  console.log(`\n💰 Generating ${count} payments...`)
  
  const methods = ['BANK_TRANSFER', 'ALIPAY', 'WECHAT_PAY', 'CASH']
  const invoiceTypes = ['VAT_SPECIAL', 'VAT_NORMAL', 'RECEIPT']
  const payments = []
  
  for (let i = 0; i < count; i++) {
    const order = randomChoice(orders)
    const amount = randomInt(5000, 100000)
    const paymentNo = `PAY${Date.now()}${i}`
    
    const payment = await prisma.payment.create({
      data: {
        paymentNo,
        orderId: order.id,
        amount,
        paymentMethod: randomChoice(methods) as any,
        paymentDate: new Date(Date.now() - randomInt(0, 15) * 24 * 60 * 60 * 1000),
        invoiceType: randomChoice(invoiceTypes) as any,
        remarks: `收款备注 ${i + 1}`,
        operatorId: adminId,
      }
    })
    payments.push(payment)
  }
  
  console.log(`✅ Created ${payments.length} payments`)
  return payments
}

// 生成任务数据
async function generateTasks(adminId: string, customers: any[], count: number = 15) {
  console.log(`\n✅ Generating ${count} tasks...`)
  
  const titles = [
    '跟进客户需求',
    '准备方案文档',
    '安排产品演示',
    '合同谈判',
    '售后服务回访',
    '客户关系维护',
    '市场调研分析',
    '竞争对手分析',
    '内部培训',
    '项目进度汇报'
  ]
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
  const statuses = ['TODO', 'IN_PROGRESS', 'COMPLETED']
  
  const tasks = []
  for (let i = 0; i < count; i++) {
    const task = await prisma.task.create({
      data: {
        title: `${randomChoice(titles)} ${i + 1}`,
        description: `这是任务描述 ${i + 1}`,
        assigneeId: adminId,
        creatorId: adminId,
        priority: randomChoice(priorities) as any,
        status: randomChoice(statuses) as any,
        startDate: new Date(),
        endDate: new Date(Date.now() + randomInt(1, 30) * 24 * 60 * 60 * 1000),
      }
    })
    tasks.push(task)
  }
  
  console.log(`✅ Created ${tasks.length} tasks`)
  return tasks
}

// 生成年报数据
async function generateDailyReports(adminId: string, count: number = 10) {
  console.log(`\n📝 Generating ${count} daily reports...`)
  
  const reports = []
  // 从30天前开始生成,避免与现有数据冲突
  for (let i = 0; i < count; i++) {
    const reportDate = new Date(Date.now() - (30 + i) * 24 * 60 * 60 * 1000)
    reportDate.setHours(0, 0, 0, 0) // 设置为当天零点
    
    const report = await prisma.dailyReport.create({
      data: {
        userId: adminId,
        title: `${reportDate.getMonth() + 1}月${reportDate.getDate()}日工作日报`,
        content: `今天主要完成了以下工作:\n1. 客户跟进\n2. 订单处理\n3. 团队协作`,
        workSummary: `今日工作总结:\n- 完成${randomInt(1, 5)}个客户沟通\n- 处理${randomInt(1, 3)}个订单\n- 参加团队会议`,
        tomorrowPlan: `明日计划:\n- 继续跟进意向客户\n- 准备下周方案\n- 完成月度报告`,
        issues: i % 3 === 0 ? '暂无问题' : '需要协调资源',
        reportDate,
        status: randomChoice(['DRAFT', 'SUBMITTED', 'REVIEWED']) as any,
      }
    })
    reports.push(report)
  }
  
  console.log(`✅ Created ${reports.length} daily reports`)
  return reports
}

// 生成跟进记录
async function generateFollowUps(adminId: string, customers: any[], count: number = 20) {
  console.log(`\n📞 Generating ${count} follow-ups...`)
  
  const types = ['PHONE', 'VISIT', 'EMAIL', 'WECHAT', 'MEETING']
  const results = [
    '客户表示感兴趣,需要进一步沟通',
    '已预约下次见面时间',
    '客户暂时不需要,保持联系',
    '达成初步合作意向',
    '需要提供更多资料',
    '价格方面需要协商',
    '客户要求修改方案',
    '等待客户内部审批'
  ]
  
  const followUps = []
  for (let i = 0; i < count; i++) {
    const customer = randomChoice(customers)
    
    const followUp = await prisma.followUp.create({
      data: {
        customerId: customer.id,
        salesId: adminId,
        type: randomChoice(types) as any,
        content: `跟进内容: 与客户沟通了产品详情和合作方案`,
        result: randomChoice(results),
        nextAction: '继续跟进',
        nextFollowUpAt: new Date(Date.now() + randomInt(1, 7) * 24 * 60 * 60 * 1000),
        status: 'COMPLETED',
      }
    })
    followUps.push(followUp)
  }
  
  console.log(`✅ Created ${followUps.length} follow-ups`)
  return followUps
}

// 主函数
async function main() {
  console.log('🚀 Generating comprehensive test data...\n')
  console.log('=' .repeat(60))
  
  try {
    // 获取管理员用户
    const adminUser = await getAdminUser()
    console.log(`✅ Using admin user: ${adminUser.realName} (${adminUser.username})`)
    
    // 1. 生成客户
    const customers = await generateCustomers(adminUser.id, 20)
    
    // 2. 生成订单
    const orders = await generateOrders(adminUser.id, customers, 15)
    
    // 3. 生成收款记录
    const payments = await generatePayments(adminUser.id, orders, 10)
    
    // 4. 生成任务
    const tasks = await generateTasks(adminUser.id, customers, 15)
    
    // 5. 生成年报
    const reports = await generateDailyReports(adminUser.id, 10)
    
    // 6. 生成跟进记录
    const followUps = await generateFollowUps(adminUser.id, customers, 20)
    
    console.log('\n' + '='.repeat(60))
    console.log('\n✅ Test data generation completed successfully!\n')
    console.log('📊 Data Summary:')
    console.log(`   👥 Customers: ${customers.length}`)
    console.log(`   📦 Orders: ${orders.length}`)
    console.log(`   💰 Payments: ${payments.length}`)
    console.log(`   ✅ Tasks: ${tasks.length}`)
    console.log(`   📝 Daily Reports: ${reports.length}`)
    console.log(`   📞 Follow-ups: ${followUps.length}`)
    console.log(`\n🎉 All data has been saved to database!`)
    console.log(`\n🌐 You can now access the system at: http://localhost:3008`)
    console.log(`   Username: admin`)
    console.log(`   Password: admin123`)
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
