import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * 自动将3个月无跟进的客户移入公海池
 * 规则: lastFollowUpAt 或 createdAt 超过3个月且未进入公海池
 */
async function moveToPublicPool() {
  console.log('🔄 Starting public pool automation...\n')
  
  try {
    // 计算3个月前的日期
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    
    console.log(`Checking for customers inactive since ${threeMonthsAgo.toISOString()}\n`)
    
    // 查找符合条件的客户
    const customers = await prisma.customer.findMany({
      where: {
        isPublic: false,
        OR: [
          {
            AND: [
              { lastFollowUpAt: { not: null } },
              { lastFollowUpAt: { lt: threeMonthsAgo } }
            ]
          },
          {
            AND: [
              { lastFollowUpAt: null },
              { createdAt: { lt: threeMonthsAgo } }
            ]
          }
        ]
      },
      include: {
        sales: {
          select: {
            realName: true
          }
        }
      }
    })
    
    console.log(`Found ${customers.length} customers to move to public pool\n`)
    
    // 批量更新
    let updatedCount = 0
    for (const customer of customers) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          isPublic: true,
          status: 'INACTIVE',
        }
      })
      
      console.log(`✓ Moved to public pool: ${customer.name} (${customer.company || 'No company'})`)
      console.log(`  Previous owner: ${customer.sales.realName}`)
      console.log(`  Last follow-up: ${customer.lastFollowUpAt?.toLocaleDateString('zh-CN') || 'Never'}\n`)
      
      updatedCount++
    }
    
    console.log('\n✅ Public pool automation completed!')
    console.log(`   Total moved: ${updatedCount} customers`)
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

moveToPublicPool().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
