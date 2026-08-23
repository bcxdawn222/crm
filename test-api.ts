import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testCreateCustomer() {
  console.log('\n🧪 Testing Customer Creation...')
  
  try {
    // Get admin user ID
    const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
    if (!adminUser) {
      console.error('❌ Admin user not found!')
      return false
    }
    
    console.log(`✅ Found admin user: ${adminUser.id}`)
    
    // Try to create a customer with correct enum values
    const customer = await prisma.customer.create({
      data: {
        name: '测试客户',
        company: '测试公司',
        phone: '13800138000',
        email: 'test@example.com',
        address: '测试地址',
        level: 'POTENTIAL',
        source: 'WEBSITE',
        notes: '测试备注',
        salesId: adminUser.id,
        status: 'ACTIVE',
      }
    })
    
    console.log(`✅ Customer created successfully: ${customer.name}`)
    console.log(`   - Level: ${customer.level}`)
    console.log(`   - Source: ${customer.source}`)
    console.log(`   - Status: ${customer.status}`)
    
    // Clean up - delete the test customer
    await prisma.customer.delete({ where: { id: customer.id } })
    console.log(`✅ Test customer deleted successfully`)
    
    return true
  } catch (error: any) {
    console.error('❌ Failed to create customer:', error.message)
    console.error('   Error details:', error.meta || error.cause)
    return false
  }
}

async function main() {
  console.log('🚀 Starting API tests...\n')
  
  const success = await testCreateCustomer()
  
  if (success) {
    console.log('\n✅ All tests passed!')
    console.log('The API should work correctly now.')
  } else {
    console.log('\n❌ Tests failed! Please check the errors above.')
  }
  
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
