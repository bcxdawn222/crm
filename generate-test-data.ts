import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 随机数生成器
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

// 随机选择数组元素
const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// 姓名数据
const firstNames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗']
const lastNames = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平']

// 公司数据
const companies = [
  '北京科技有限公司',
  '上海贸易发展有限公司',
  '广州制造厂',
  '深圳创新科技公司',
  '杭州电子商务公司',
  '成都餐饮管理公司',
  '武汉建筑工程公司',
  '南京金融服务公司',
  '西安文化传媒公司',
  '天津物流服务公司',
  '重庆汽车制造公司',
  '青岛海洋科技公司',
  '大连软件开发公司',
]

// 城市数据
const cities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '天津']
const streets = ['中山路', '人民路', '解放路', '建设路', '和平路', '胜利路', '光明路', '幸福路', '长安街', '复兴路']

// 日报内容模板
const workContentTemplates = [
  '今天拜访了3个客户,了解了他们的需求和痛点,并提供了相应的解决方案建议。',
  '完成了本月销售目标的80%,跟进重点客户的合同谈判,预计下周可以签约。',
  '参加了产品培训会议,学习了新功能的使用方法,并向团队进行了分享。',
  '整理了客户资料库,更新了客户联系方式和需求信息,提高了数据准确性。',
  '与技术支持团队协作,解决了客户反馈的产品问题,获得了客户好评。',
  '分析了竞争对手的产品特点和市场策略,制定了针对性的销售方案。',
  '维护了老客户关系,进行了定期回访,了解客户使用情况和满意度。',
  '参与了新产品的市场推广活动,收集了潜在客户信息,为后续跟进做准备。',
  '优化了销售流程,提高了工作效率,缩短了客户响应时间。',
  '协助团队成员解决销售过程中遇到的问题,共同提升了团队业绩。',
]

const tomorrowPlanTemplates = [
  '明天计划拜访2个新客户,继续跟进今天的意向客户。',
  '准备下周的合同谈判材料,整理报价方案和产品展示PPT。',
  '参加部门例会,汇报本周工作进展和下周工作计划。',
  '学习新产品知识,为即将到来的产品发布会做准备。',
  '回访上周签约的客户,了解产品使用情况和满意度。',
  '分析本月的销售数据,找出问题和改进方向。',
  '与合作伙伴进行沟通,商讨下一步的合作计划。',
  '整理客户反馈意见,提交给产品和技术团队进行优化。',
  '制定下个月的销售目标和行动计划。',
  '参加行业交流会,拓展人脉资源,寻找新的商机。',
]

const issueTemplates = [
  '部分客户对产品价格有异议,需要进一步沟通和协商。',
  '技术支持响应速度有待提高,影响了客户满意度。',
  '市场竞争激烈,需要加强产品差异化优势的展示。',
  '内部协作流程不够顺畅,导致项目进度有所延误。',
  '客户需求变化较快,需要更灵活地调整方案。',
  '产品某些功能还不够完善,客户提出了一些改进建议。',
  '销售工具和数据支持不足,影响了工作效率。',
  '新员工对产品熟悉度不够,需要加强培训。',
  '市场活动效果评估机制需要进一步完善。',
  '无',
]

// 任务标题模板
const taskTitles = [
  '跟进客户A的合同谈判',
  '准备产品演示材料',
  '整理月度销售报告',
  '联系潜在客户B',
  '更新客户资料库',
  '参加产品培训',
  '分析竞品动态',
  '制定营销方案',
  '协调技术支持',
  '完成季度总结',
]

const taskDescriptions = [
  '需要与客户确认合同细节,包括价格、交付时间和售后服务条款。',
  '为客户C准备个性化的产品演示,突出其关注的功能点。',
  '汇总本月销售数据,分析完成情况和存在的问题。',
  '通过电话或邮件联系潜在客户,了解其需求并安排面谈。',
  '检查客户信息的完整性和准确性,补充缺失的关键信息。',
  '学习新产品功能和使用方法,掌握核心卖点。',
  '调研主要竞争对手的最新动态和市场策略。',
  '针对目标客户群体制定精准的营销推广方案。',
  '与技术团队沟通,解决客户反馈的技术问题。',
  '回顾本季度工作成果,总结经验教训,规划下季度目标。',
]

async function generateRandomCustomers(count: number, adminId: string) {
  console.log(`\n📊 Generating ${count} random customers...`)
  
  const levels = ['POTENTIAL', 'NORMAL', 'VIP', 'IMPORTANT']
  const sources = ['WEBSITE', 'REFERRAL', 'ADVERTISEMENT', 'EXHIBITION', 'COLD_CALL', 'SOCIAL_MEDIA', 'OTHER']
  const statuses = ['ACTIVE', 'INACTIVE']
  
  const customers = []
  
  for (let i = 0; i < count; i++) {
    const firstName = randomChoice(firstNames)
    const lastName = randomChoice(lastNames)
    const name = `${firstName}${lastName}`
    
    const company = randomChoice(companies)
    const city = randomChoice(cities)
    const street = randomChoice(streets)
    const address = `${city}${street}${randomInt(1, 999)}号`
    
    // 生成随机手机号
    const phone = `1${randomInt(3, 9)}${String(randomInt(10000000, 99999999))}`
    
    // 生成邮箱
    const email = `${name.toLowerCase()}${randomInt(1, 999)}@example.com`
    
    const noteTemplates = [
      `${company}的采购负责人,对产品很感兴趣,需要进一步了解。`,
      `通过展会认识,有明确的采购需求,预算充足。`,
      `老客户推荐,信誉良好,合作意愿强。`,
      `正在比较多家供应商,需要我们提供更有竞争力的方案。`,
      `之前使用过竞品,现在想更换供应商,关注产品质量和售后服务。`,
      `初创公司,预算有限但发展潜力大,值得长期跟进。`,
      `大型企业,决策流程较长,需要耐心跟进。`,
      `对价格敏感,需要在保证质量的前提下提供优惠方案。`,
      `技术导向型客户,需要提供详细的技术参数和案例。`,
      `关系型客户,重视个人关系和服务态度。`,
    ]
    
    customers.push({
      name,
      company,
      phone,
      email,
      address,
      level: randomChoice(levels) as any,
      source: randomChoice(sources) as any,
      notes: randomChoice(noteTemplates),
      salesId: adminId, // 假设admin用户ID
      status: randomChoice(statuses) as any,
    })
  }
  
  return customers
}

async function generateRandomOrders(customerIds: string[], count: number, adminId: string) {
  console.log(`\n📊 Generating ${count} random orders...`)
  
  const statuses = ['PENDING', 'CONFIRMED', 'DELIVERING', 'COMPLETED', 'CANCELLED']
  
  const orders = []
  
  for (let i = 0; i < count; i++) {
    const customerId = randomChoice(customerIds)
    const contractAmount = randomInt(10000, 500000)
    const paidAmount = randomInt(0, contractAmount)
    const unpaidAmount = contractAmount - paidAmount
    
    // 生成随机日期(过去6个月内)
    const signDate = new Date()
    signDate.setDate(signDate.getDate() - randomInt(1, 180))
    
    orders.push({
      orderNo: `ORD${Date.now()}${randomInt(100, 999)}`,
      customerId,
      contractAmount,
      paidAmount,
      unpaidAmount,
      currency: 'CNY',
      signDate,
      deliveryDate: null,
      remarks: `订单备注: ${randomChoice(['加急处理', '正常交付', '分批交付', '定制需求'])}`,
      salesId: adminId,
      status: randomChoice(statuses) as any,
    })
  }
  
  return orders
}

async function generateRandomPayments(orderIds: string[], count: number, adminId: string) {
  console.log(`\n📊 Generating ${count} random payments...`)
  
  const paymentMethods = ['BANK_TRANSFER', 'ALIPAY', 'WECHAT_PAY', 'CHECK', 'CASH']
  const invoiceTypes = ['VAT_SPECIAL', 'VAT_NORMAL', 'RECEIPT']
  
  const payments = []
  
  for (let i = 0; i < count; i++) {
    const orderId = randomChoice(orderIds)
    const amount = randomInt(1000, 50000)
    
    const paymentDate = new Date()
    paymentDate.setDate(paymentDate.getDate() - randomInt(1, 90))
    
    payments.push({
      paymentNo: `PAY${Date.now()}${randomInt(100, 999)}`,
      orderId,
      amount,
      paymentMethod: randomChoice(paymentMethods) as any,
      paymentDate,
      invoiceNo: `INV${randomInt(100000, 999999)}`,
      invoiceType: randomChoice(invoiceTypes) as any,
      remarks: `收款备注: ${randomChoice(['首付款', '进度款', '尾款', '全款'])}`,
      operatorId: adminId,
    })
  }
  
  return payments
}

async function generateRandomDailyReports(count: number, adminId: string) {
  console.log(`\n📊 Generating ${count} random daily reports...`)
  
  const reports = []
  
  for (let i = 0; i < count; i++) {
    const reportDate = new Date()
    reportDate.setDate(reportDate.getDate() - randomInt(1, 30))
    
    reports.push({
      userId: adminId,
      title: `日报-${reportDate.toISOString().split('T')[0]}`,
      content: randomChoice(workContentTemplates),
      workSummary: randomChoice(workContentTemplates),
      tomorrowPlan: randomChoice(tomorrowPlanTemplates),
      issues: randomChoice(issueTemplates),
      attachments: null,
      reportDate,
      status: 'SUBMITTED' as any,
    })
  }
  
  return reports
}

async function generateRandomTasks(count: number, adminId: string) {
  console.log(`\n📊 Generating ${count} random tasks...`)
  
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
  const statuses = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
  const relatedTypes = ['CUSTOMER', 'ORDER', 'LEAD', 'GENERAL']
  
  const tasks = []
  
  for (let i = 0; i < count; i++) {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + randomInt(1, 30))
    
    tasks.push({
      title: randomChoice(taskTitles),
      description: randomChoice(taskDescriptions),
      priority: randomChoice(priorities) as any,
      status: randomChoice(statuses) as any,
      assigneeId: adminId,
      creatorId: adminId,
      startDate: null,
      endDate: dueDate,
      completedAt: null,
      projectId: null,
      tags: null,
      attachments: null,
    })
  }
  
  return tasks
}

async function main() {
  console.log('🚀 Starting comprehensive test data generation...\n')
  console.log('=' .repeat(60))
  
  try {
    // 获取admin用户ID
    const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
    if (!adminUser) {
      throw new Error('Admin user not found!')
    }
    const adminId = adminUser.id
    console.log(`✅ Found admin user: ${adminId}\n`)
    
    // 1. 生成客户数据 (50个)
    const customers = await generateRandomCustomers(50, adminId)
    const createdCustomers = await prisma.customer.createMany({
      data: customers,
      skipDuplicates: true,
    })
    console.log(`✅ Created ${createdCustomers.count} customers`)
    
    // 获取所有客户ID
    const allCustomers = await prisma.customer.findMany({ select: { id: true } })
    const customerIds = allCustomers.map(c => c.id)
    
    // 2. 生成订单数据 (30个)
    const orders = await generateRandomOrders(customerIds, 30, adminId)
    const createdOrders = await prisma.order.createMany({
      data: orders,
      skipDuplicates: true,
    })
    console.log(`✅ Created ${createdOrders.count} orders`)
    
    // 获取所有订单ID
    const allOrders = await prisma.order.findMany({ select: { id: true } })
    const orderIds = allOrders.map(o => o.id)
    
    // 3. 生成收款记录 (20个)
    const payments = await generateRandomPayments(orderIds, 20, adminId)
    const createdPayments = await prisma.payment.createMany({
      data: payments,
      skipDuplicates: true,
    })
    console.log(`✅ Created ${createdPayments.count} payments`)
    
    // 4. 生成日报 (15个)
    const dailyReports = await generateRandomDailyReports(15, adminId)
    const createdReports = await prisma.dailyReport.createMany({
      data: dailyReports,
      skipDuplicates: true,
    })
    console.log(`✅ Created ${createdReports.count} daily reports`)
    
    // 5. 生成任务 (25个)
    const tasks = await generateRandomTasks(25, adminId)
    const createdTasks = await prisma.task.createMany({
      data: tasks,
      skipDuplicates: true,
    })
    console.log(`✅ Created ${createdTasks.count} tasks`)
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ All test data generated successfully!\n')
    
    // 统计信息
    const stats = {
      customers: await prisma.customer.count(),
      orders: await prisma.order.count(),
      payments: await prisma.payment.count(),
      dailyReports: await prisma.dailyReport.count(),
      tasks: await prisma.task.count(),
    }
    
    console.log('📈 Database Statistics:')
    console.log(`   Customers:     ${stats.customers}`)
    console.log(`   Orders:        ${stats.orders}`)
    console.log(`   Payments:      ${stats.payments}`)
    console.log(`   Daily Reports: ${stats.dailyReports}`)
    console.log(`   Tasks:         ${stats.tasks}`)
    
    console.log('\n Server is running at: http://localhost:3008')
    console.log(' Login credentials:')
    console.log('   Username: admin')
    console.log('   Password: admin123')
    console.log('\n💡 You can now test all features with rich data!')
    
  } catch (error) {
    console.error('\n❌ Error generating test data:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
