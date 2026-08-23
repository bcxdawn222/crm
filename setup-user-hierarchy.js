const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function setupHierarchy() {
  console.log('🌱 Setting up user hierarchy...\n')
  
  try {
    // Get users
    const admin = await prisma.user.findUnique({ where: { username: 'admin' } })
    const manager = await prisma.user.findUnique({ where: { username: 'manager' } })
    const sales = await prisma.user.findUnique({ where: { username: 'sales' } })
    const finance = await prisma.user.findUnique({ where: { username: 'finance' } })
    
    if (!admin || !manager || !sales || !finance) {
      console.error('❌ Some users not found. Please ensure all demo users exist.')
      return
    }
    
    console.log(`✅ Found users:`)
    console.log(`   - Admin: ${admin.realName} (${admin.id})`)
    console.log(`   - Manager: ${manager.realName} (${manager.id})`)
    console.log(`   - Sales: ${sales.realName} (${sales.id})`)
    console.log(`   - Finance: ${finance.realName} (${finance.id})\n`)
    
    // Set hierarchy
    console.log('🔧 Setting up hierarchy...')
    
    // Sales reports to Manager
    await prisma.user.update({
      where: { id: sales.id },
      data: { managerId: manager.id }
    })
    console.log(`   ✓ ${sales.realName} now reports to ${manager.realName}`)
    
    // Manager and Finance have no manager (null)
    await prisma.user.update({
      where: { id: manager.id },
      data: { managerId: null }
    })
    console.log(`   ✓ ${manager.realName} has no manager (top level)`)
    
    await prisma.user.update({
      where: { id: finance.id },
      data: { managerId: null }
    })
    console.log(`   ✓ ${finance.realName} has no manager (independent department)`)
    
    console.log('\n✅ Hierarchy setup completed successfully!\n')
    
    // Display hierarchy tree
    console.log('📊 Current Hierarchy:')
    console.log('├─ Admin (系统管理员)')
    console.log('   ├─ Manager (销售主管)')
    console.log('   │  └─ Sales (销售代表)')
    console.log('   └─ Finance (财务人员)\n')
    
    console.log('💡 Data Access Rules:')
    console.log('   • Admin: Can view ALL data')
    console.log('   • Manager: Can view own + Sales\' data')
    console.log('   • Sales: Can only view own data')
    console.log('   • Finance: Can view ALL data (for financial purposes)\n')
    
  } catch (error) {
    console.error('❌ Error setting up hierarchy:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupHierarchy()
