const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Helper functions
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  console.log('🚀 Starting comprehensive CRM system tests...\n')
  
  try {
    // Get admin user
    const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
    if (!adminUser) {
      console.error('❌ Admin user not found')
      return
    }
    
    console.log(`✅ Using admin: ${adminUser.username} (ID: ${adminUser.id})\n`)
    
    // Test 1: Create multiple customers
    console.log('📋 Test 1: Creating 8 customers...')
    const names = ['Zhang San', 'Li Si', 'Wang Wu', 'Zhao Liu', 'Sun Qi', 'Zhou Ba', 'Wu Jiu', 'Zheng Shi']
    const companies = ['Tech Co', 'Trade Co', 'Finance Co', 'Manufacturing Co', 'Service Co']
    const levels = ['POTENTIAL', 'NORMAL', 'IMPORTANT', 'VIP']
    const sources = ['WEBSITE', 'REFERRAL', 'COLD_CALL', 'EXHIBITION']
    
    const customers = []
    for (let i = 0; i < names.length; i++) {
      const customer = await prisma.customer.create({
        data: {
          name: names[i],
          company: randomChoice(companies),
          phone: `138${String(randomInt(10000000, 99999999))}`,
          email: `${names[i].toLowerCase().replace(/\s/g, '.')}@example.com`,
          address: `Beijing Road ${randomInt(1, 999)}`,
          level: randomChoice(levels),
          source: randomChoice(sources),
          notes: `Test customer ${i + 1}`,
          salesId: adminUser.id,
          isPublic: false,
          status: 'ACTIVE',
        }
      })
      customers.push(customer)
    }
    console.log(`✅ Created ${customers.length} customers\n`)
    
    // Test 2: Archive some customers to public pool
    console.log('🗄️ Test 2: Archiving 3 customers to public pool...')
    const archiveCustomers = customers.slice(0, 3)
    for (const customer of archiveCustomers) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          isPublic: true,
          status: 'INACTIVE',
        }
      })
      console.log(`  ✓ Archived: ${customer.name}`)
    }
    console.log(`✅ Archived ${archiveCustomers.length} customers\n`)
    
    // Test 3: Create follow-ups for active customers
    console.log('📞 Test 3: Creating follow-ups...')
    const activeCustomers = customers.slice(3, 6)
    for (const customer of activeCustomers) {
      const followUpCount = randomInt(1, 3)
      for (let i = 0; i < followUpCount; i++) {
        const followUpDate = new Date()
        followUpDate.setDate(followUpDate.getDate() - randomInt(1, 30))
        
        await prisma.followUp.create({
          data: {
            customerId: customer.id,
            userId: adminUser.id,
            type: randomChoice(['PHONE', 'VISIT', 'EMAIL']),
            content: `Follow-up content ${i + 1}`,
            nextStep: `Next step ${i + 1}`,
            followUpAt: followUpDate,
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
      
      console.log(`  ✓ Created follow-ups for: ${customer.name}`)
    }
    console.log(`✅ Created follow-ups\n`)
    
    // Test 4: Create orders
    console.log('💰 Test 4: Creating orders...')
    const orderCustomers = customers.slice(5, 8)
    for (const customer of orderCustomers) {
      const order = await prisma.order.create({
        data: {
          customerId: customer.id,
          orderNo: `ORD${Date.now()}${randomInt(100, 999)}`,
          amount: randomInt(1000, 50000),
          status: randomChoice(['DRAFT', 'CONFIRMED', 'COMPLETED']),
          remark: `Order for ${customer.name}`,
        }
      })
      console.log(`  ✓ Order created for: ${customer.name} - Amount: ¥${order.amount}`)
    }
    console.log(`✅ Created orders\n`)
    
    // Test 5: Create payments
    console.log('💳 Test 5: Creating payments...')
    const orders = await prisma.order.findMany({ take: 3 })
    for (const order of orders) {
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.amount * 0.5,
          method: randomChoice(['BANK_TRANSFER', 'ALIPAY', 'WECHAT']),
          paidAt: new Date(),
          remark: 'Payment received',
        }
      })
      console.log(`  ✓ Payment: ¥${payment.amount} for order ${order.orderNo}`)
    }
    console.log(`✅ Created payments\n`)
    
    // Test 6: Create tasks
    console.log('📝 Test 6: Creating tasks...')
    for (let i = 0; i < 5; i++) {
      const task = await prisma.task.create({
        data: {
          title: `Task ${i + 1}: Follow up with customer`,
          description: `Complete task ${i + 1}`,
          priority: randomChoice(['LOW', 'MEDIUM', 'HIGH']),
          status: randomChoice(['TODO', 'IN_PROGRESS', 'COMPLETED']),
          dueDate: new Date(Date.now() + randomInt(1, 7) * 24 * 60 * 60 * 1000),
          assigneeId: adminUser.id,
        }
      })
      console.log(`  ✓ Task created: ${task.title}`)
    }
    console.log(`✅ Created tasks\n`)
    
    // Test 7: Create daily reports
    console.log('📊 Test 7: Creating daily reports...')
    for (let i = 0; i < 5; i++) {
      const reportDate = new Date()
      reportDate.setDate(reportDate.getDate() - i)
      reportDate.setHours(0, 0, 0, 0)
      
      const report = await prisma.dailyReport.create({
        data: {
          userId: adminUser.id,
          title: `Daily Report - ${reportDate.toLocaleDateString()}`,
          content: `Work summary for ${reportDate.toLocaleDateString()}`,
          workSummary: 'Completed customer follow-ups and order processing',
          tomorrowPlan: 'Continue following up with potential customers',
          issues: 'None',
          reportDate: reportDate,
          status: 'SUBMITTED',
        }
      })
      console.log(`  ✓ Report created for: ${reportDate.toLocaleDateString()}`)
    }
    console.log(`✅ Created daily reports\n`)
    
    // Summary
    console.log('📊 Test Summary:')
    const customerCount = await prisma.customer.count()
    const followUpCount = await prisma.followUp.count()
    const orderCount = await prisma.order.count()
    const paymentCount = await prisma.payment.count()
    const taskCount = await prisma.task.count()
    const reportCount = await prisma.dailyReport.count()
    const publicPoolCount = await prisma.customer.count({ where: { isPublic: true } })
    
    console.log(`  👥 Total Customers: ${customerCount}`)
    console.log(`  🗄️ Public Pool: ${publicPoolCount}`)
    console.log(`  📞 Follow-ups: ${followUpCount}`)
    console.log(`  💰 Orders: ${orderCount}`)
    console.log(`  💳 Payments: ${paymentCount}`)
    console.log(`  📝 Tasks: ${taskCount}`)
    console.log(`  📊 Daily Reports: ${reportCount}`)
    
    console.log('\n✅ All tests completed successfully!')
    console.log('\n🎯 You can now test the following features:')
    console.log('  1. View customer list at http://localhost:3008/customers')
    console.log('  2. Archive customers to public pool')
    console.log('  3. View public pool at http://localhost:3008/public-pool')
    console.log('  4. Claim customers from public pool')
    console.log('  5. Check all other modules (orders, tasks, reports)')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
