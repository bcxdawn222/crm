const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seedTelemarketingData() {
  console.log('🌱 Seeding telemarketing data...\n')
  
  try {
    // Get admin user (sales)
    const adminUser = await prisma.user.findFirst({ 
      where: { username: 'admin' } 
    })
    
    if (!adminUser) {
      console.error('❌ Admin user not found')
      return
    }
    
    console.log(`✅ Using user: ${adminUser.username} (${adminUser.realName})\n`)
    
    // Create sample telemarketing records
    const telemarketingData = [
      {
        name: '张三',
        company: '北京科技有限公司',
        phone: '13800138001',
        position: '总经理',
        industry: '互联网',
        source: '展会',
        callTimes: 2,
        status: 'CONNECTED',
        result: 'INTERESTED',
        notes: '对公司产品很感兴趣,需要进一步了解价格和方案',
        isEffective: true,
        salesId: adminUser.id,
      },
      {
        name: '李四',
        company: '上海贸易公司',
        phone: '13800138002',
        position: '采购经理',
        industry: '贸易',
        source: '网站',
        callTimes: 1,
        status: 'NOT_ANSWERED',
        result: null,
        notes: '第一次拨打未接听,需要再次联系',
        isEffective: false,
        salesId: adminUser.id,
      },
      {
        name: '王五',
        company: '深圳制造企业',
        phone: '13800138003',
        position: '总监',
        industry: '制造业',
        source: '推荐',
        callTimes: 3,
        status: 'FOLLOW_UP',
        result: 'NEED_FOLLOWUP',
        notes: '有需求但需要内部讨论,约定下周再次沟通',
        isEffective: true,
        salesId: adminUser.id,
      },
      {
        name: '赵六',
        company: '广州服务公司',
        phone: '13800138004',
        position: '负责人',
        industry: '服务业',
        source: '广告',
        callTimes: 1,
        status: 'BUSY',
        result: null,
        notes: '正在开会,稍后回电',
        isEffective: false,
        salesId: adminUser.id,
      },
      {
        name: '孙七',
        company: '杭州电商公司',
        phone: '13800138005',
        position: '运营总监',
        industry: '电商',
        source: '社交媒体',
        callTimes: 4,
        status: 'CONVERTED',
        result: 'INTERESTED',
        notes: '已转化为正式客户,签订了合作协议',
        isEffective: true,
        salesId: adminUser.id,
      },
      {
        name: '周八',
        company: '',
        phone: '13800138006',
        position: '',
        industry: '',
        source: '电销名单购买',
        callTimes: 1,
        status: 'INVALID',
        result: 'WRONG_NUMBER',
        notes: '号码错误,无法接通',
        isEffective: false,
        salesId: adminUser.id,
      },
      {
        name: '吴九',
        company: '成都软件公司',
        phone: '13800138007',
        position: '技术总监',
        industry: '软件',
        source: '官网咨询',
        callTimes: 2,
        status: 'CALLBACK',
        result: 'NEED_FOLLOWUP',
        notes: '需要了解技术细节,安排了技术团队跟进',
        isEffective: true,
        salesId: adminUser.id,
      },
      {
        name: '郑十',
        company: '武汉教育培训机构',
        phone: '13800138008',
        position: '校长',
        industry: '教育',
        source: '转介绍',
        callTimes: 1,
        status: 'PENDING',
        result: null,
        notes: '新获取的线索,尚未拨打',
        isEffective: false,
        salesId: adminUser.id,
      },
    ]
    
    console.log('📝 Creating telemarketing records...')
    
    let createdCount = 0
    for (const data of telemarketingData) {
      await prisma.telemarketingList.create({
        data: {
          ...data,
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date within last 7 days
        }
      })
      createdCount++
      console.log(`  ✓ Created: ${data.name} (${data.company || '无公司'})`)
    }
    
    console.log(`\n✅ Successfully created ${createdCount} telemarketing records\n`)
    
    // Show statistics
    const stats = await prisma.telemarketingList.groupBy({
      by: ['status'],
      _count: true,
      where: {
        salesId: adminUser.id
      }
    })
    
    console.log('📊 Statistics:')
    stats.forEach(stat => {
      console.log(`  ${stat.status}: ${stat._count} records`)
    })
    
    const effectiveCount = await prisma.telemarketingList.count({
      where: {
        salesId: adminUser.id,
        isEffective: true
      }
    })
    
    console.log(`  有效客户: ${effectiveCount}`)
    console.log(`  总计: ${createdCount}\n`)
    
    console.log('🎯 You can now:')
    console.log('  1. Open browser: http://localhost:3008/telemarketing')
    console.log('  2. Login: admin / 123456')
    console.log('  3. View and manage telemarketing records')
    console.log('  4. Convert effective leads to customers\n')
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedTelemarketingData()
