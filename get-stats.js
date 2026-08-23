const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function getStats() {
  const stats = {
    customers: await prisma.customer.count(),
    activeCustomers: await prisma.customer.count({ where: { isPublic: false, status: 'ACTIVE' } }),
    publicPoolCustomers: await prisma.customer.count({ where: { isPublic: true } }),
    orders: await prisma.order.count(),
    totalContractAmount: (await prisma.order.aggregate({ _sum: { contractAmount: true } }))._sum.contractAmount || 0,
    followUps: await prisma.followUp.count(),
    payments: await prisma.payment.count(),
    reports: await prisma.dailyReport.count()
  }
  
  console.log('\n 测试数据统计汇总:')
  console.log('='.repeat(50))
  console.log(`\n 客户总数: ${stats.customers}`)
  console.log(`   ├─ 活跃客户: ${stats.activeCustomers}`)
  console.log(`   └─ 公海池: ${stats.publicPoolCustomers}`)
  console.log(`\n💰 订单总数: ${stats.orders}`)
  console.log(`   └─ 合同总金额: ¥${Number(stats.totalContractAmount).toLocaleString()}`)
  console.log(`\n📞 跟进记录: ${stats.followUps}`)
  console.log(`💵 收款记录: ${stats.payments}`)
  console.log(`📝 日报数量: ${stats.reports}`)
  console.log('\n' + '='.repeat(50))
  
  await prisma.$disconnect()
}

getStats().catch(console.error)
