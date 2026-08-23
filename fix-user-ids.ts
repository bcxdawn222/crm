import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixTestData() {
  console.log('🔧 Fixing test data user IDs...\n')
  
  try {
    // auth.ts中admin用户的ID是'1'
    const correctUserId = '1'
    
    // 获取数据库中的admin用户(UUID格式)
    const dbAdmin = await prisma.user.findFirst({ where: { username: 'admin' } })
    
    if (!dbAdmin) {
      console.error('❌ Database admin user not found')
      return
    }
    
    console.log(`Database admin ID: ${dbAdmin.id}`)
    console.log(`Auth system admin ID: ${correctUserId}`)
    console.log('\nUpdating all test data to use correct user ID...\n')
    
    // 更新客户的salesId
    console.log('Updating customers...')
    await prisma.customer.updateMany({
      where: { salesId: dbAdmin.id },
      data: { salesId: correctUserId }
    })
    
    // 更新订单的salesId
    console.log('Updating orders...')
    await prisma.order.updateMany({
      where: { salesId: dbAdmin.id },
      data: { salesId: correctUserId }
    })
    
    // 更新收款记录的operatorId
    console.log('Updating payments...')
    await prisma.payment.updateMany({
      where: { operatorId: dbAdmin.id },
      data: { operatorId: correctUserId }
    })
    
    // 更新任务的assigneeId和creatorId
    console.log('Updating tasks...')
    await prisma.task.updateMany({
      where: { assigneeId: dbAdmin.id },
      data: { assigneeId: correctUserId }
    })
    await prisma.task.updateMany({
      where: { creatorId: dbAdmin.id },
      data: { creatorId: correctUserId }
    })
    
    // 更新日报的userId
    console.log('Updating daily reports...')
    await prisma.dailyReport.updateMany({
      where: { userId: dbAdmin.id },
      data: { userId: correctUserId }
    })
    
    // 更新跟进记录的salesId
    console.log('Updating follow-ups...')
    await prisma.followUp.updateMany({
      where: { salesId: dbAdmin.id },
      data: { salesId: correctUserId }
    })
    
    console.log('\n✅ All test data updated successfully!')
    console.log('\nNow you can login with:')
    console.log('  Username: admin')
    console.log('  Password: 123456')
    console.log('\nAnd see all the test data!')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

fixTestData().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
