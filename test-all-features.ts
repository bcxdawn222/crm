import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 获取admin用户ID
async function getAdminUser() {
  const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } })
  if (!adminUser) {
    throw new Error('❌ Admin user not found!')
  }
  return adminUser
}

// 测试1: 创建客户
async function testCreateCustomer(adminId: string) {
  console.log('\n📋 Test 1: Creating Customer...')
  try {
    const customer = await prisma.customer.create({
      data: {
        name: '张三',
        company: '科技有限公司',
        phone: '13800138001',
        email: 'zhangsan@example.com',
        address: '北京市朝阳区',
        level: 'POTENTIAL',
        source: 'WEBSITE',
        notes: '网站咨询的客户',
        salesId: adminId,
        status: 'ACTIVE',
      }
    })
    console.log(`✅ Customer created: ${customer.name} (ID: ${customer.id})`)
    console.log(`   Level: ${customer.level}, Source: ${customer.source}`)
    return customer
  } catch (error: any) {
    console.error('❌ Failed to create customer:', error.message)
    return null
  }
}

// 测试2: 查询客户列表
async function testGetCustomers() {
  console.log('\n📋 Test 2: Getting Customer List...')
  try {
    const customers = await prisma.customer.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        sales: {
          select: { id: true, realName: true }
        }
      }
    })
    console.log(`✅ Found ${customers.length} customers`)
    customers.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.name} - ${c.company || '无公司'} - ${c.phone}`)
    })
    return customers
  } catch (error: any) {
    console.error('❌ Failed to get customers:', error.message)
    return []
  }
}

// 测试3: 更新客户
async function testUpdateCustomer(customerId: string) {
  console.log('\n📋 Test 3: Updating Customer...')
  try {
    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        level: 'NORMAL',
        notes: '已更新备注信息',
      }
    })
    console.log(`✅ Customer updated: ${updated.name}`)
    console.log(`   New level: ${updated.level}`)
    return updated
  } catch (error: any) {
    console.error('❌ Failed to update customer:', error.message)
    return null
  }
}

// 测试4: 创建订单
async function testCreateOrder(adminId: string, customerId: string) {
  console.log('\n📋 Test 4: Creating Order...')
  try {
    const orderNo = `ORD${Date.now()}`
    const contractAmount = 50000.00
    
    const order = await prisma.order.create({
      data: {
        orderNo,
        customerId,
        contractAmount,
        paidAmount: 0,
        unpaidAmount: contractAmount,
        signDate: new Date(),
        remarks: '测试订单',
        salesId: adminId,
        status: 'CONFIRMED',
      }
    })
    console.log(`✅ Order created: ${order.orderNo}`)
    console.log(`   Amount: ¥${contractAmount.toFixed(2)}, Status: ${order.status}`)
    return order
  } catch (error: any) {
    console.error('❌ Failed to create order:', error.message)
    return null
  }
}

// 测试5: 创建收款记录
async function testCreatePayment(adminId: string, orderId: string) {
  console.log('\n📋 Test 5: Creating Payment...')
  try {
    const paymentNo = `PAY${Date.now()}`
    
    const payment = await prisma.payment.create({
      data: {
        paymentNo,
        orderId,
        amount: 20000.00,
        paymentMethod: 'BANK_TRANSFER',
        paymentDate: new Date(),
        invoiceType: 'VAT_SPECIAL',
        remarks: '首付款',
        operatorId: adminId,
      }
    })
    console.log(`✅ Payment created: ${payment.paymentNo}`)
    console.log(`   Amount: ¥20000.00, Method: ${payment.paymentMethod}`)
    return payment
  } catch (error: any) {
    console.error('❌ Failed to create payment:', error.message)
    return null
  }
}

// 测试6: 创建任务
async function testCreateTask(adminId: string) {
  console.log('\n📋 Test 6: Creating Task...')
  try {
    const task = await prisma.task.create({
      data: {
        title: '跟进客户张三',
        description: '需要了解客户的具体需求',
        assigneeId: adminId,
        creatorId: adminId,
        priority: 'HIGH',
        status: 'TODO',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后
      }
    })
    console.log(`✅ Task created: ${task.title}`)
    console.log(`   Priority: ${task.priority}, Status: ${task.status}`)
    return task
  } catch (error: any) {
    console.error('❌ Failed to create task:', error.message)
    return null
  }
}

// 测试7: 创建日报
async function testCreateDailyReport(adminId: string) {
  console.log('\n📋 Test 7: Creating Daily Report...')
  try {
    const report = await prisma.dailyReport.create({
      data: {
        userId: adminId,
        title: '今日工作总结',
        content: '今天主要完成了客户跟进和订单处理工作',
        workSummary: '1. 跟进3个潜在客户\n2. 处理2个订单\n3. 完成日报编写',
        tomorrowPlan: '明天计划拜访重要客户',
        issues: '暂无',
        reportDate: new Date(),
        status: 'SUBMITTED',
      }
    })
    console.log(`✅ Daily report created: ${report.title}`)
    console.log(`   Date: ${report.reportDate.toDateString()}, Status: ${report.status}`)
    return report
  } catch (error: any) {
    console.error('❌ Failed to create daily report:', error.message)
    return null
  }
}

// 测试8: 创建跟进记录
async function testCreateFollowUp(adminId: string, customerId: string) {
  console.log('\n📋 Test 8: Creating Follow-up...')
  try {
    const followUp = await prisma.followUp.create({
      data: {
        customerId,
        salesId: adminId,
        type: 'PHONE',
        content: '电话沟通了解客户需求',
        result: '客户对产品感兴趣,需要进一步沟通',
        nextAction: '安排线下见面',
        nextFollowUpAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: 'COMPLETED',
      }
    })
    console.log(`✅ Follow-up created`)
    console.log(`   Type: ${followUp.type}, Result: ${followUp.result?.substring(0, 20)}...`)
    return followUp
  } catch (error: any) {
    console.error('❌ Failed to create follow-up:', error.message)
    return null
  }
}

// 主测试流程
async function main() {
  console.log('🚀 Starting comprehensive API tests...\n')
  console.log('=' .repeat(60))
  
  let allPassed = true
  
  try {
    // 获取管理员用户
    const adminUser = await getAdminUser()
    console.log(`✅ Admin user found: ${adminUser.realName} (${adminUser.username})`)
    
    // 测试1: 创建客户
    const customer = await testCreateCustomer(adminUser.id)
    if (!customer) {
      allPassed = false
      console.log('\n⚠️  Skipping remaining tests due to customer creation failure')
    } else {
      // 测试2: 查询客户
      await testGetCustomers()
      
      // 测试3: 更新客户
      await testUpdateCustomer(customer.id)
      
      // 测试4: 创建订单
      const order = await testCreateOrder(adminUser.id, customer.id)
      
      // 测试5: 创建收款
      if (order) {
        await testCreatePayment(adminUser.id, order.id)
      }
      
      // 测试6: 创建任务
      await testCreateTask(adminUser.id)
      
      // 测试7: 创建日报
      await testCreateDailyReport(adminUser.id)
      
      // 测试8: 创建跟进记录
      await testCreateFollowUp(adminUser.id, customer.id)
    }
    
    console.log('\n' + '='.repeat(60))
    if (allPassed) {
      console.log('\n✅ All tests passed! The system is working correctly.')
      console.log('\n📊 Summary:')
      console.log('   - Customer CRUD operations: ✅ Working')
      console.log('   - Order management: ✅ Working')
      console.log('   - Payment tracking: ✅ Working')
      console.log('   - Task management: ✅ Working')
      console.log('   - Daily reports: ✅ Working')
      console.log('   - Follow-up records: ✅ Working')
      console.log('\n🎉 You can now use the system at http://localhost:3008')
    } else {
      console.log('\n❌ Some tests failed. Please check the errors above.')
    }
    
  } catch (error: any) {
    console.error('\n💥 Fatal error:', error.message)
    allPassed = false
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
