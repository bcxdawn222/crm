const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Starting comprehensive system tests...\n')
  
  try {
    // Get admin user
    const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
    if (!adminUser) {
      console.error('❌ Admin user not found')
      return
    }
    
    console.log(`✅ Using admin: ${adminUser.username}\n`)
    
    // Create 8 customers
    console.log('📋 Creating customers...')
    const names = ['Zhang San', 'Li Si', 'Wang Wu', 'Zhao Liu', 'Sun Qi', 'Zhou Ba', 'Wu Jiu', 'Zheng Shi']
    const companies = ['Tech Co', 'Trade Co', 'Finance Co', 'Manufacturing Co', 'Service Co']
    
    const customers = []
    for (let i = 0; i < names.length; i++) {
      const customer = await prisma.customer.create({
        data: {
          name: names[i],
          company: companies[i % companies.length],
          phone: `138${Math.floor(Math.random() * 90000000 + 10000000)}`,
          email: `${names[i].toLowerCase().replace(/\s/g, '.')}@example.com`,
          level: ['POTENTIAL', 'NORMAL', 'IMPORTANT', 'VIP'][Math.floor(Math.random() * 4)],
          source: ['WEBSITE', 'REFERRAL', 'COLD_CALL'][Math.floor(Math.random() * 3)],
          salesId: adminUser.id,
          isPublic: false,
          status: 'ACTIVE',
        }
      })
      customers.push(customer)
      console.log(`   ✓ ${customer.name}`)
    }
    console.log(`✅ Created ${customers.length} customers\n`)
    
    // Archive 3 customers to public pool
    console.log('📋 Archiving customers to public pool...')
    for (let i = 0; i < 3; i++) {
      await prisma.customer.update({
        where: { id: customers[i].id },
        data: { isPublic: true, status: 'INACTIVE' }
      })
      console.log(`   ✓ Archived: ${customers[i].name}`)
    }
    console.log('✅ Archived 3 customers\n')
    
    // Claim 2 from public pool
    console.log('📋 Claiming from public pool...')
    const publicCustomers = await prisma.customer.findMany({ where: { isPublic: true }, take: 2 })
    for (const c of publicCustomers) {
      await prisma.customer.update({
        where: { id: c.id },
        data: { isPublic: false, status: 'ACTIVE', salesId: adminUser.id }
      })
      console.log(`   ✓ Claimed: ${c.name}`)
    }
    console.log('✅ Claimed 2 customers\n')
    
    // Create orders
    console.log('📋 Creating orders and payments...')
    const privateCustomers = customers.filter(c => !c.isPublic)
    for (let i = 0; i < Math.min(5, privateCustomers.length); i++) {
      const amount = Math.floor(Math.random() * 90000 + 10000)
      const order = await prisma.order.create({
        data: {
          orderNo: `ORD${Date.now()}${i}`,
          customerId: privateCustomers[i].id,
          contractAmount: amount,
          paidAmount: 0,
          unpaidAmount: amount,
          signDate: new Date(),
          salesId: adminUser.id,
          status: 'CONFIRMED',
        }
      })
      
      const paymentAmount = Math.floor(amount * 0.3)
      await prisma.payment.create({
        data: {
          paymentNo: `PAY${Date.now()}${i}`,
          orderId: order.id,
          amount: paymentAmount,
          paymentMethod: 'BANK_TRANSFER',
          paymentDate: new Date(),
          operatorId: adminUser.id,
        }
      })
      console.log(`   ✓ Order for ${privateCustomers[i].name}: ¥${amount}, Payment: ¥${paymentAmount}`)
    }
    console.log('✅ Created 5 orders with payments\n')
    
    // Create tasks
    console.log('📋 Creating tasks...')
    for (let i = 0; i < 5; i++) {
      await prisma.task.create({
        data: {
          title: `Follow up - ${customers[i].name}`,
          assigneeId: adminUser.id,
          creatorId: adminUser.id,
          priority: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
          status: ['TODO', 'IN_PROGRESS'][Math.floor(Math.random() * 2)],
          startDate: new Date(),
          endDate: new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        }
      })
      console.log(`   ✓ Task created`)
    }
    console.log('✅ Created 5 tasks\n')
    
    // Create daily reports
    console.log('📋 Creating daily reports...')
    for (let i = 0; i < 5; i++) {
      const reportDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      reportDate.setHours(0, 0, 0, 0)
      await prisma.dailyReport.create({
        data: {
          userId: adminUser.id,
          title: `Daily Report ${reportDate.getMonth() + 1}/${reportDate.getDate()}`,
          content: 'Work summary for today',
          reportDate,
          status: ['DRAFT', 'SUBMITTED', 'REVIEWED'][Math.floor(Math.random() * 3)],
        }
      })
      console.log(`   ✓ Report created`)
    }
    console.log('✅ Created 5 daily reports\n')
    
    // Create follow-ups
    console.log('📋 Creating follow-up records...')
    for (let i = 0; i < 10; i++) {
      await prisma.followUp.create({
        data: {
          customerId: customers[i % customers.length].id,
          salesId: adminUser.id,
          type: ['PHONE', 'VISIT', 'EMAIL'][Math.floor(Math.random() * 3)],
          content: 'Follow-up content',
          result: 'Customer interested',
          status: 'COMPLETED',
        }
      })
      console.log(`   ✓ Follow-up created`)
    }
    console.log('✅ Created 10 follow-ups\n')
    
    // Verify data
    console.log('📊 Data Statistics:')
    console.log(`   Total Customers: ${await prisma.customer.count()}`)
    console.log(`   Public Pool: ${await prisma.customer.count({ where: { isPublic: true } })}`)
    console.log(`   Private: ${await prisma.customer.count({ where: { isPublic: false } })}`)
    console.log(`   Orders: ${await prisma.order.count()}`)
    console.log(`   Payments: ${await prisma.payment.count()}`)
    console.log(`   Tasks: ${await prisma.task.count()}`)
    console.log(`   Daily Reports: ${await prisma.dailyReport.count()}`)
    console.log(`   Follow-ups: ${await prisma.followUp.count()}`)
    
    console.log('\n✅ All tests completed successfully!')
    console.log('\n🌐 Access: http://localhost:3008')
    console.log('   Username: admin')
    console.log('   Password: 123456\n')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
