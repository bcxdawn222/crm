const { PrismaClient } = require('@prisma/client')

async function testDailyLeads() {
  const prisma = new PrismaClient()
  
  console.log('🧪 Testing Daily Leads Feature...\n')
  
  try {
    // Get admin user
    const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
    if (!adminUser) {
      console.error('❌ Admin user not found')
      return
    }
    
    console.log(`✅ Using admin: ${adminUser.username}\n`)
    
    // Create customers with different dates
    console.log('📋 Creating test customers with various dates...')
    
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    
    const threeDaysAgo = new Date(today)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    
    // Today's customers
    for (let i = 1; i <= 5; i++) {
      await prisma.customer.create({
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
    }
    console.log('  ✓ Created 5 customers for today')
    
    // Yesterday's customers
    for (let i = 1; i <= 3; i++) {
      await prisma.customer.create({
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
    }
    console.log('  ✓ Created 3 customers for yesterday')
    
    // Two days ago customers
    for (let i = 1; i <= 4; i++) {
      await prisma.customer.create({
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
    }
    console.log('  ✓ Created 4 customers for two days ago')
    
    // Three days ago customers
    for (let i = 1; i <= 2; i++) {
      await prisma.customer.create({
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
    }
    console.log('  ✓ Created 2 customers for three days ago')
    
    console.log('\n✅ Test data created successfully!\n')
    
    // Verify statistics
    console.log('📊 Expected Statistics:')
    console.log('  Today:', today.toISOString().split('T')[0], '- 5 customers')
    console.log('  Yesterday:', yesterday.toISOString().split('T')[0], '- 3 customers')
    console.log('  Two Days Ago:', twoDaysAgo.toISOString().split('T')[0], '- 4 customers')
    console.log('  Three Days Ago:', threeDaysAgo.toISOString().split('T')[0], '- 2 customers')
    console.log('  Total: 14 customers across 4 days\n')
    
    console.log('🎯 You can now:')
    console.log('  1. Start server: npm run dev -- -p 3008')
    console.log('  2. Login: admin / 123456')
    console.log('  3. Navigate to "客户管理" -> "每日新增客资"')
    console.log('  4. View daily statistics and filter by date range')
    console.log('  5. Click on any day to see detailed customer list\n')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

testDailyLeads().catch(console.error)
