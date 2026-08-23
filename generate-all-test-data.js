const { PrismaClient } = require('@prisma/client')

async function comprehensiveTestData() {
  const prisma = new PrismaClient()
  
  console.log('🚀 Starting comprehensive test data generation...\n')
  
  try {
    // Get admin user
    const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
    if (!adminUser) {
      console.error('❌ Admin user not found!')
      return
    }
    
    console.log(`✅ Using admin: ${adminUser.username} (ID: ${adminUser.id})\n`)
    
    // Clear existing test data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing test data...')
    await prisma.followUp.deleteMany({})
    await prisma.payment.deleteMany({})
    await prisma.order.deleteMany({})
    await prisma.dailyReport.deleteMany({})
    await prisma.task.deleteMany({})
    await prisma.customer.deleteMany({})
    console.log('✅ Test data cleared\n')
    
    // ==================== 1. Create Customers ====================
    console.log('📋 Creating customers...')
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const threeDaysAgo = new Date(today)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const fourDaysAgo = new Date(today)
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4)
    const fiveDaysAgo = new Date(today)
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    
    const customers = []
    
    // Today's customers (5)
    for (let i = 1; i <= 5; i++) {
      const customer = await prisma.customer.create({
        data: {
          name: `Today Customer ${i}`,
          company: `Company T${i}`,
          phone: `13800000${String(i).padStart(2, '0')}`,
          email: `today${i}@example.com`,
          level: i % 2 === 0 ? 'NORMAL' : 'POTENTIAL',
          source: i % 3 === 0 ? 'WEBSITE' : 'REFERRAL',
          salesId: adminUser.id,
          isPublic: false,
          status: 'ACTIVE',
          createdAt: today,
        }
      })
      customers.push(customer)
    }
    console.log('  ✓ Created 5 customers for today')
    
    // Yesterday's customers (3)
    for (let i = 1; i <= 3; i++) {
      const customer = await prisma.customer.create({
        data: {
          name: `Yesterday Customer ${i}`,
          company: `Company Y${i}`,
          phone: `13800001${String(i).padStart(2, '0')}`,
          email: `yesterday${i}@example.com`,
          level: 'IMPORTANT',
          source: 'ADVERTISEMENT',
          salesId: adminUser.id,
          isPublic: false,
          status: 'ACTIVE',
          createdAt: yesterday,
        }
      })
      customers.push(customer)
    }
    console.log('  ✓ Created 3 customers for yesterday')
    
    // Two days ago customers (4)
    for (let i = 1; i <= 4; i++) {
      const customer = await prisma.customer.create({
        data: {
          name: `Two Days Ago Customer ${i}`,
          company: `Company D${i}`,
          phone: `13800002${String(i).padStart(2, '0')}`,
          email: `twodays${i}@example.com`,
          level: i === 1 ? 'VIP' : 'NORMAL',
          source: 'EXHIBITION',
          salesId: adminUser.id,
          isPublic: false,
          status: 'ACTIVE',
          createdAt: twoDaysAgo,
        }
      })
      customers.push(customer)
    }
    console.log('  ✓ Created 4 customers for two days ago')
    
    // Three days ago customers (2)
    for (let i = 1; i <= 2; i++) {
      const customer = await prisma.customer.create({
        data: {
          name: `Three Days Ago Customer ${i}`,
          company: `Company T${i}`,
          phone: `13800003${String(i).padStart(2, '0')}`,
          email: `threedays${i}@example.com`,
          level: 'POTENTIAL',
          source: 'COLD_CALL',
          salesId: adminUser.id,
          isPublic: false,
          status: 'ACTIVE',
          createdAt: threeDaysAgo,
        }
      })
      customers.push(customer)
    }
    console.log('  ✓ Created 2 customers for three days ago')
    
    // Four days ago customers (3)
    for (let i = 1; i <= 3; i++) {
      const customer = await prisma.customer.create({
        data: {
          name: `Four Days Ago Customer ${i}`,
          company: `Company F${i}`,
          phone: `13800004${String(i).padStart(2, '0')}`,
          email: `fourdays${i}@example.com`,
          level: 'NORMAL',
          source: 'SOCIAL_MEDIA',
          salesId: adminUser.id,
          isPublic: false,
          status: 'ACTIVE',
          createdAt: fourDaysAgo,
        }
      })
      customers.push(customer)
    }
    console.log('  ✓ Created 3 customers for four days ago')
    
    // Five days ago customers (2)
    for (let i = 1; i <= 2; i++) {
      const customer = await prisma.customer.create({
        data: {
          name: `Five Days Ago Customer ${i}`,
          company: `Company FV${i}`,
          phone: `13800005${String(i).padStart(2, '0')}`,
          email: `fivedays${i}@example.com`,
          level: 'IMPORTANT',
          source: 'OTHER',
          salesId: adminUser.id,
          isPublic: false,
          status: 'ACTIVE',
          createdAt: fiveDaysAgo,
        }
      })
      customers.push(customer)
    }
    console.log('  ✓ Created 2 customers for five days ago')
    
    // Archive 2 customers to public pool
    console.log('\n🗄️  Archiving 2 customers to public pool...')
    const toArchive = customers.slice(0, 2)
    for (const customer of toArchive) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          isPublic: true,
          status: 'INACTIVE',
        }
      })
      console.log(`  ✓ Archived: ${customer.name}`)
    }
    
    console.log(`\n✅ Total customers created: ${customers.length}\n`)
    
    // ==================== 2. Create Follow-ups ====================
    console.log('📞 Creating follow-ups...')
    const activeCustomers = customers.filter(c => !c.isPublic).slice(0, 10)
    for (const customer of activeCustomers) {
      const followUpCount = Math.floor(Math.random() * 3) + 1
      for (let i = 0; i < followUpCount; i++) {
        const followUpDate = new Date()
        followUpDate.setDate(followUpDate.getDate() - Math.floor(Math.random() * 5))
        
        await prisma.followUp.create({
          data: {
            customerId: customer.id,
            salesId: adminUser.id,
            type: ['PHONE', 'VISIT', 'EMAIL'][Math.floor(Math.random() * 3)],
            content: `Follow-up content for ${customer.name} - ${i + 1}`,
            nextAction: `Next step: schedule meeting`,
            nextFollowUpAt: followUpDate,
          }
        })
      }
      
      // Update lastFollowUpAt
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          lastFollowUpAt: new Date(),
        }
      })
    }
    console.log('  ✓ Created follow-ups for active customers\n')
    
    // ==================== 3. Create Orders ====================
    console.log('💰 Creating orders...')
    const orderCustomers = activeCustomers.slice(0, 8)
    for (const customer of orderCustomers) {
      const amount = Math.floor(Math.random() * 50000) + 1000
      const order = await prisma.order.create({
        data: {
          customerId: customer.id,
          salesId: adminUser.id,
          orderNo: `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`,
          contractAmount: amount,
          paidAmount: 0,
          unpaidAmount: amount,
          currency: 'CNY',
          status: ['PENDING', 'CONFIRMED', 'COMPLETED'][Math.floor(Math.random() * 3)],
          remarks: `Order for ${customer.name}`,
        }
      })
      console.log(`  ✓ Order: ¥${amount} for ${customer.name}`)
    }
    console.log('  ✓ Orders created\n')
    
    // ==================== 4. Create Payments ====================
    console.log('💳 Creating payments...')
    const orders = await prisma.order.findMany({ take: 5 })
    for (const order of orders) {
      const paymentAmount = Number(order.contractAmount) * 0.5
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          paymentNo: `PAY${Date.now()}${Math.floor(Math.random() * 1000)}`,
          amount: paymentAmount,
          paymentMethod: ['BANK_TRANSFER', 'ALIPAY', 'WECHAT_PAY'][Math.floor(Math.random() * 3)],
          paymentDate: new Date(),
          operatorId: adminUser.id,
          remarks: 'Payment received',
        }
      })
      console.log(`  ✓ Payment: ¥${paymentAmount} for order ${order.orderNo}`)
    }
    console.log('  ✓ Payments created\n')
    
    // ==================== 5. Create Tasks ====================
    console.log('📝 Creating tasks...')
    for (let i = 1; i <= 10; i++) {
      const task = await prisma.task.create({
        data: {
          title: `Task ${i}: Follow up with customer`,
          description: `Complete task ${i} - contact customer and discuss requirements`,
          priority: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
          status: ['TODO', 'IN_PROGRESS', 'COMPLETED'][Math.floor(Math.random() * 3)],
          endDate: new Date(Date.now() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
          assigneeId: adminUser.id,
          creatorId: adminUser.id,
        }
      })
      console.log(`  ✓ Task: ${task.title}`)
    }
    console.log('  ✓ Tasks created\n')
    
    // ==================== 6. Create Daily Reports ====================
    console.log('📊 Creating daily reports...')
    for (let i = 0; i < 5; i++) {
      const reportDate = new Date()
      reportDate.setDate(reportDate.getDate() - i)
      reportDate.setHours(0, 0, 0, 0)
      
      const report = await prisma.dailyReport.create({
        data: {
          userId: adminUser.id,
          title: `Daily Report - ${reportDate.toLocaleDateString()}`,
          content: `Work summary for ${reportDate.toLocaleDateString()}\n\nCompleted customer follow-ups and order processing.`,
          workSummary: `- Completed ${Math.floor(Math.random() * 5) + 1} customer communications\n- Processed ${Math.floor(Math.random() * 3) + 1} orders\n- Attended team meeting`,
          tomorrowPlan: `- Continue following up with potential customers\n- Prepare proposals for next week\n- Complete monthly report`,
          issues: i % 3 === 0 ? 'No issues' : 'Need to coordinate resources',
          reportDate: reportDate,
          status: ['DRAFT', 'SUBMITTED', 'REVIEWED'][Math.floor(Math.random() * 3)],
        }
      })
      console.log(`  ✓ Report: ${reportDate.toLocaleDateString()}`)
    }
    console.log('  ✓ Daily reports created\n')
    
    // ==================== Summary ====================
    console.log('📊 Final Statistics:')
    const customerCount = await prisma.customer.count()
    const publicPoolCount = await prisma.customer.count({ where: { isPublic: true } })
    const followUpCount = await prisma.followUp.count()
    const orderCount = await prisma.order.count()
    const paymentCount = await prisma.payment.count()
    const taskCount = await prisma.task.count()
    const reportCount = await prisma.dailyReport.count()
    
    console.log(`  👥 Total Customers: ${customerCount}`)
    console.log(`  🗄️  Public Pool: ${publicPoolCount}`)
    console.log(`  📞 Follow-ups: ${followUpCount}`)
    console.log(`  💰 Orders: ${orderCount}`)
    console.log(`  💳 Payments: ${paymentCount}`)
    console.log(`  📝 Tasks: ${taskCount}`)
    console.log(`  📊 Daily Reports: ${reportCount}`)
    
    console.log('\n✅ All test data generated successfully!\n')
    console.log('🎯 You can now test all features:')
    console.log('  1. Customer Management (/customers)')
    console.log('  2. Public Pool (/public-pool)')
    console.log('  3. Daily Leads (/daily-leads)')
    console.log('  4. Orders (/finance/orders)')
    console.log('  5. Payments (/finance/payments)')
    console.log('  6. Tasks (/tasks)')
    console.log('  7. Daily Reports (/daily-reports)')
    console.log('\n  Login: admin / 123456')
    console.log('  URL: http://localhost:3008\n')
    
  } catch (error) {
    console.error('❌ Test data generation failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

comprehensiveTestData().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
