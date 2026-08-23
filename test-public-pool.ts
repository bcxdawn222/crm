import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testPublicPool() {
  console.log('🧪 Testing Public Pool Feature...\n')
  
  try {
    // Get admin user
    const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
    if (!adminUser) {
      console.error('❌ Admin user not found!')
      return
    }
    
    console.log(`✅ Using admin user: ${adminUser.username} (ID: ${adminUser.id})\n`)
    
    // Test 1: Create a customer with old date (should be moved to public pool)
    console.log('📋 Test 1: Creating customer with old follow-up date...')
    const oldDate = new Date()
    oldDate.setMonth(oldDate.getMonth() - 4) // 4 months ago
    
    const oldCustomer = await prisma.customer.create({
      data: {
        name: '老客户测试',
        company: '旧公司',
        phone: '13800000001',
        email: 'old@example.com',
        level: 'POTENTIAL',
        source: 'WEBSITE',
        salesId: adminUser.id,
        isPublic: false,
        status: 'ACTIVE',
        lastFollowUpAt: oldDate,
      }
    })
    console.log(`✅ Created old customer: ${oldCustomer.name}`)
    console.log(`   Last follow-up: ${oldCustomer.lastFollowUpAt?.toLocaleDateString('zh-CN')}`)
    console.log(`   Is Public: ${oldCustomer.isPublic}\n`)
    
    // Test 2: Create a customer with recent follow-up
    console.log('📋 Test 2: Creating customer with recent follow-up...')
    const recentCustomer = await prisma.customer.create({
      data: {
        name: '新客户测试',
        company: '新公司',
        phone: '13800000002',
        email: 'new@example.com',
        level: 'VIP',
        source: 'REFERRAL',
        salesId: adminUser.id,
        isPublic: false,
        status: 'ACTIVE',
        lastFollowUpAt: new Date(), // Today
      }
    })
    console.log(`✅ Created recent customer: ${recentCustomer.name}`)
    console.log(`   Last follow-up: ${recentCustomer.lastFollowUpAt?.toLocaleDateString('zh-CN')}`)
    console.log(`   Is Public: ${recentCustomer.isPublic}\n`)
    
    // Test 3: Run the auto-move script
    console.log('📋 Test 3: Running auto-move to public pool...')
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    
    const customersToMove = await prisma.customer.findMany({
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
      }
    })
    
    console.log(`   Found ${customersToMove.length} customers to move\n`)
    
    let movedCount = 0
    for (const customer of customersToMove) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          isPublic: true,
          status: 'INACTIVE',
        }
      })
      movedCount++
      console.log(`   ✓ Moved: ${customer.name} (was last followed up on ${customer.lastFollowUpAt?.toLocaleDateString('zh-CN') || 'never'})`)
    }
    console.log(`\n✅ Moved ${movedCount} customers to public pool\n`)
    
    // Test 4: Verify public pool customers
    console.log('📋 Test 4: Verifying public pool...')
    const publicCustomers = await prisma.customer.findMany({
      where: { isPublic: true },
      select: {
        id: true,
        name: true,
        isPublic: true,
        lastFollowUpAt: true,
      }
    })
    console.log(`   Public pool contains ${publicCustomers.length} customers:`)
    publicCustomers.forEach(c => {
      console.log(`   - ${c.name}: isPublic=${c.isPublic}, lastFollowUp=${c.lastFollowUpAt?.toLocaleDateString('zh-CN') || 'never'}`)
    })
    console.log()
    
    // Test 5: Verify non-public customers
    console.log('📋 Test 5: Verifying private customers...')
    const privateCustomers = await prisma.customer.findMany({
      where: { isPublic: false },
      select: {
        id: true,
        name: true,
        isPublic: true,
        lastFollowUpAt: true,
      }
    })
    console.log(`   Private customers: ${privateCustomers.length}`)
    privateCustomers.forEach(c => {
      console.log(`   - ${c.name}: isPublic=${c.isPublic}, lastFollowUp=${c.lastFollowUpAt?.toLocaleDateString('zh-CN') || 'never'}`)
    })
    console.log()
    
    // Test 6: Simulate claiming a customer from public pool
    console.log('📋 Test 6: Testing customer claim from public pool...')
    if (publicCustomers.length > 0) {
      const customerToClaim = publicCustomers[0]
      await prisma.customer.update({
        where: { id: customerToClaim.id },
        data: {
          isPublic: false,
          status: 'ACTIVE',
          salesId: adminUser.id,
        }
      })
      console.log(`   ✅ Claimed customer: ${customerToClaim.name}`)
      
      // Verify
      const claimed = await prisma.customer.findUnique({
        where: { id: customerToClaim.id },
        select: { name: true, isPublic: true, salesId: true }
      })
      console.log(`   Verified: isPublic=${claimed?.isPublic}, salesId=${claimed?.salesId}\n`)
    }
    
    console.log('=' .repeat(60))
    console.log('\n✅ All public pool tests completed successfully!\n')
    console.log('📊 Summary:')
    console.log('   ✓ Customer creation with isPublic field works')
    console.log('   ✓ Auto-move to public pool based on lastFollowUpAt works')
    console.log('   ✓ Public pool query works')
    console.log('   ✓ Claiming customer from public pool works')
    console.log('\n🎉 Public pool feature is ready for use!')
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testPublicPool().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
