import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating demo users in database...\n')
  
  try {
    // 删除现有的所有测试数据(因为外键关联问题)
    console.log('Clearing existing test data...')
    await prisma.followUp.deleteMany({})
    await prisma.payment.deleteMany({})
    await prisma.order.deleteMany({})
    await prisma.dailyReport.deleteMany({})
    await prisma.task.deleteMany({})
    await prisma.customer.deleteMany({})
    
    // 删除旧的用户
    console.log('Deleting old users...')
    await prisma.user.deleteMany({
      where: {
        username: { in: ['admin', 'manager', 'sales', 'finance'] }
      }
    })
    
    // 创建或更新admin用户(ID='1')
    const hashedPassword = await bcrypt.hash('123456', 10)
    
    const adminUser = await prisma.user.upsert({
      where: { id: '1' },
      update: {},
      create: {
        id: '1',
        username: 'admin',
        email: 'admin@crm.com',
        password: hashedPassword,
        realName: '系统管理员',
        status: 'ACTIVE',
      }
    })
    
    console.log(`✅ Admin user created/updated: ${adminUser.username} (ID: ${adminUser.id})`)
    
    // 创建其他演示用户
    const managerUser = await prisma.user.upsert({
      where: { id: '2' },
      update: {},
      create: {
        id: '2',
        username: 'manager',
        email: 'manager@crm.com',
        password: hashedPassword,
        realName: '销售主管',
        status: 'ACTIVE',
      }
    })
    
    const salesUser = await prisma.user.upsert({
      where: { id: '3' },
      update: {},
      create: {
        id: '3',
        username: 'sales',
        email: 'sales@crm.com',
        password: hashedPassword,
        realName: '销售代表',
        status: 'ACTIVE',
      }
    })
    
    const financeUser = await prisma.user.upsert({
      where: { id: '4' },
      update: {},
      create: {
        id: '4',
        username: 'finance',
        email: 'finance@crm.com',
        password: hashedPassword,
        realName: '财务人员',
        status: 'ACTIVE',
      }
    })
    
    console.log(`✅ Manager user created: ${managerUser.username} (ID: ${managerUser.id})`)
    console.log(`✅ Sales user created: ${salesUser.username} (ID: ${salesUser.id})`)
    console.log(`✅ Finance user created: ${financeUser.username} (ID: ${financeUser.id})`)
    
    console.log('\n✅ All demo users created successfully!')
    console.log('\nLogin credentials:')
    console.log('  admin / 123456')
    console.log('  manager / 123456')
    console.log('  sales / 123456')
    console.log('  finance / 123456')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
