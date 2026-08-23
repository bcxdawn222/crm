import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearTestData() {
  console.log('🗑️  Clearing test data...\n')
  
  try {
    // 获取admin用户ID
    const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
    if (!adminUser) {
      console.error('❌ Admin user not found')
      return
    }
    
    // 按依赖关系逆序删除
    console.log('Deleting follow-ups...')
    await prisma.followUp.deleteMany({ where: { salesId: adminUser.id } })
    
    console.log('Deleting payments...')
    await prisma.payment.deleteMany({ where: { operatorId: adminUser.id } })
    
    console.log('Deleting orders...')
    await prisma.order.deleteMany({ where: { salesId: adminUser.id } })
    
    console.log('Deleting daily reports...')
    await prisma.dailyReport.deleteMany({ where: { userId: adminUser.id } })
    
    console.log('Deleting tasks...')
    await prisma.task.deleteMany({ 
      where: { 
        OR: [
          { assigneeId: adminUser.id },
          { creatorId: adminUser.id }
        ]
      }
    })
    
    console.log('Deleting customers...')
    await prisma.customer.deleteMany({ where: { salesId: adminUser.id } })
    
    console.log('\n✅ All test data cleared successfully!')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

clearTestData().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
