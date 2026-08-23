const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seedCooperatingCustomers() {
  console.log('🌱 Seeding cooperating customers data...\n')
  
  try {
    // Get admin user
    const adminUser = await prisma.user.findFirst({ 
      where: { username: 'admin' } 
    })
    
    if (!adminUser) {
      console.error('❌ Admin user not found')
      return
    }
    
    console.log(`✅ Using user: ${adminUser.username} (${adminUser.realName})\n`)
    
    // Create sample cooperating customers
    const customers = [
      {
        name: '张三',
        company: '北京科技有限公司',
        contactPerson: '张总',
        phone: '13800138001',
        contractStartDate: new Date('2025-01-01'),
        contractEndDate: new Date('2026-08-15'), // 即将到期(20天后)
        contractAmount: 500000,
        renewalReminderDays: 30,
        visitFrequency: 'MONTHLY',
        lastVisitAt: new Date('2026-07-10'),
        nextVisitAt: new Date('2026-08-10'),
        cooperationNotes: '长期合作客户,对服务很满意,预计会续签',
        salesId: adminUser.id,
        status: 'COOPERATING',
      },
      {
        name: '李四',
        company: '上海贸易公司',
        contactPerson: '李经理',
        phone: '13800138002',
        contractStartDate: new Date('2025-06-01'),
        contractEndDate: new Date('2026-07-28'), // 3天后到期
        contractAmount: 300000,
        renewalReminderDays: 30,
        visitFrequency: 'QUARTERLY',
        lastVisitAt: new Date('2026-06-15'),
        nextVisitAt: new Date('2026-07-26'),
        cooperationNotes: '合同即将到期,需要尽快联系续签',
        salesId: adminUser.id,
        status: 'COOPERATING',
      },
      {
        name: '王五',
        company: '深圳制造企业',
        contactPerson: '王总监',
        phone: '13800138003',
        contractStartDate: new Date('2024-01-01'),
        contractEndDate: new Date('2027-01-01'), // 还有一年多
        contractAmount: 1000000,
        renewalReminderDays: 60,
        visitFrequency: 'MONTHLY',
        lastVisitAt: new Date('2026-07-20'),
        nextVisitAt: new Date('2026-08-20'),
        cooperationNotes: '大客户,合作关系稳定',
        salesId: adminUser.id,
        status: 'COOPERATING',
      },
      {
        name: '赵六',
        company: '广州服务公司',
        contactPerson: '赵总',
        phone: '13800138004',
        contractStartDate: new Date('2025-03-01'),
        contractEndDate: new Date('2026-09-01'), // 一个多月后到期
        contractAmount: 200000,
        renewalReminderDays: 30,
        visitFrequency: 'WEEKLY',
        lastVisitAt: new Date('2026-07-18'),
        nextVisitAt: new Date('2026-07-25'),
        cooperationNotes: '需要每周跟进,客户比较谨慎',
        salesId: adminUser.id,
        status: 'COOPERATING',
      },
      {
        name: '孙七',
        company: '杭州电商公司',
        contactPerson: '孙运营',
        phone: '13800138005',
        contractStartDate: new Date('2025-09-01'),
        contractEndDate: new Date('2026-08-31'), // 6天后到期
        contractAmount: 450000,
        renewalReminderDays: 30,
        visitFrequency: 'MONTHLY',
        lastVisitAt: new Date('2026-07-05'),
        nextVisitAt: new Date('2026-08-05'),
        cooperationNotes: '合同快到期了,需要准备续签方案',
        salesId: adminUser.id,
        status: 'COOPERATING',
      },
    ]
    
    console.log('📝 Creating cooperating customers...')
    
    let createdCount = 0
    for (const customerData of customers) {
      await prisma.customer.create({
        data: customerData
      })
      createdCount++
      const daysLeft = Math.ceil((customerData.contractEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      console.log(`  ✓ Created: ${customerData.name} (${customerData.company}) - 剩余${daysLeft}天`)
    }
    
    console.log(`\n✅ Successfully created ${createdCount} cooperating customers\n`)
    
    // Show statistics
    const stats = await prisma.customer.groupBy({
      by: ['status'],
      _count: true,
      where: {
        salesId: adminUser.id,
        status: 'COOPERATING'
      }
    })
    
    console.log('📊 Statistics:')
    stats.forEach(stat => {
      console.log(`  ${stat.status}: ${stat._count} customers`)
    })
    
    const expiringSoon = await prisma.customer.count({
      where: {
        salesId: adminUser.id,
        status: 'COOPERATING',
        contractEndDate: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天内到期
          gte: new Date()
        }
      }
    })
    
    console.log(`  即将到期(30天内): ${expiringSoon}`)
    console.log(`  总计: ${createdCount}\n`)
    
    console.log('🎯 You can now:')
    console.log('  1. Open browser: http://localhost:3008/customers/cooperating')
    console.log('  2. Login: admin / 123456')
    console.log('  3. View cooperating customers and renewal reminders')
    console.log('  4. Edit contract information and visit schedules\n')
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedCooperatingCustomers()
