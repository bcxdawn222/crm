import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyData() {
  console.log('🔍 Verifying test data...\n')
  
  try {
    // 检查客户数量
    const customerCount = await prisma.customer.count()
    console.log(`📊 Customers: ${customerCount}`)
    
    if (customerCount > 0) {
      const sampleCustomers = await prisma.customer.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          company: true,
          phone: true,
          level: true,
          source: true,
          status: true,
        }
      })
      console.log('\nSample Customers:')
      sampleCustomers.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.name} - ${c.company || '无公司'} - ${c.phone}`)
        console.log(`     Level: ${c.level}, Source: ${c.source}, Status: ${c.status}`)
      })
    }
    
    // 检查订单数量
    const orderCount = await prisma.order.count()
    console.log(`\n📦 Orders: ${orderCount}`)
    
    if (orderCount > 0) {
      const sampleOrders = await prisma.order.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { name: true }
          }
        }
      })
      console.log('\nSample Orders:')
      sampleOrders.forEach((o, i) => {
        console.log(`  ${i + 1}. ${o.orderNo} - ${o.customer.name}`)
        console.log(`     Amount: ¥${o.contractAmount.toNumber()}, Status: ${o.status}`)
      })
    }
    
    // 检查收款记录
    const paymentCount = await prisma.payment.count()
    console.log(`\n💰 Payments: ${paymentCount}`)
    
    if (paymentCount > 0) {
      const samplePayments = await prisma.payment.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: { orderNo: true }
          }
        }
      })
      console.log('\nSample Payments:')
      samplePayments.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.paymentNo} - Order: ${p.order.orderNo}`)
        console.log(`     Amount: ¥${p.amount.toNumber()}, Method: ${p.paymentMethod}`)
      })
    }
    
    // 检查任务数量
    const taskCount = await prisma.task.count()
    console.log(`\n✅ Tasks: ${taskCount}`)
    
    if (taskCount > 0) {
      const sampleTasks = await prisma.task.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          priority: true,
          status: true,
          endDate: true,
        }
      })
      console.log('\nSample Tasks:')
      sampleTasks.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.title}`)
        console.log(`     Priority: ${t.priority}, Status: ${t.status}`)
      })
    }
    
    // 检查日报数量
    const reportCount = await prisma.dailyReport.count()
    console.log(`\n📝 Daily Reports: ${reportCount}`)
    
    if (reportCount > 0) {
      const sampleReports = await prisma.dailyReport.findMany({
        take: 3,
        orderBy: { reportDate: 'desc' },
        select: {
          id: true,
          title: true,
          reportDate: true,
          status: true,
        }
      })
      console.log('\nSample Daily Reports:')
      sampleReports.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.title}`)
        console.log(`     Date: ${r.reportDate.toDateString()}, Status: ${r.status}`)
      })
    }
    
    // 检查跟进记录
    const followUpCount = await prisma.followUp.count()
    console.log(`\n📞 Follow-ups: ${followUpCount}`)
    
    if (followUpCount > 0) {
      const sampleFollowUps = await prisma.followUp.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { name: true }
          }
        }
      })
      console.log('\nSample Follow-ups:')
      sampleFollowUps.forEach((f, i) => {
        console.log(`  ${i + 1}. Customer: ${f.customer.name}`)
        console.log(`     Type: ${f.type}, Result: ${f.result?.substring(0, 30)}...`)
      })
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('\n✅ Data verification completed!')
    console.log('\n📈 Total Records:')
    console.log(`   - Customers: ${customerCount}`)
    console.log(`   - Orders: ${orderCount}`)
    console.log(`   - Payments: ${paymentCount}`)
    console.log(`   - Tasks: ${taskCount}`)
    console.log(`   - Daily Reports: ${reportCount}`)
    console.log(`   - Follow-ups: ${followUpCount}`)
    console.log(`\n🎉 All data is ready for testing!`)
    console.log(`\n🌐 Access the system at: http://localhost:3008`)
    console.log(`   Username: admin`)
    console.log(`   Password: admin123`)
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

verifyData().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
