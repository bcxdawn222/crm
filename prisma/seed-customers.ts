import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始创建测试客户数据...')

  // 获取第一个用户(使用admin)
  const salesUser = await prisma.user.findFirst({
    where: {
      username: 'admin'
    }
  })

  if (!salesUser) {
    console.error('未找到用户')
    return
  }

  console.log(`使用销售用户: ${salesUser.realName} (${salesUser.id})`)

  // 创建测试客户数据
  const customers = [
    {
      name: '张三',
      company: '北京科技有限公司',
      phone: '13800138001',
      email: 'zhangsan@example.com',
      address: '北京市朝阳区建国路100号',
      level: 'NORMAL' as any,
      source: 'WEBSITE' as any,
      notes: '对CRM系统很感兴趣,需要详细演示',
      salesId: salesUser.id,
      status: 'ACTIVE' as any,
    },
    {
      name: '李四',
      company: '上海贸易公司',
      phone: '13800138002',
      email: 'lisi@example.com',
      address: '上海市浦东新区陆家嘴200号',
      level: 'VIP' as any,
      source: 'REFERRAL' as any,
      notes: '已签约,需要持续跟进服务',
      salesId: salesUser.id,
      status: 'ACTIVE' as any,
    },
    {
      name: '王五',
      company: '广州制造厂',
      phone: '13800138003',
      email: 'wangwu@example.com',
      address: '广州市天河区珠江新城300号',
      level: 'POTENTIAL' as any,
      source: 'COLD_CALL' as any,
      notes: '初步接触,待进一步沟通',
      salesId: salesUser.id,
      status: 'ACTIVE' as any,
    },
    {
      name: '赵六',
      company: '深圳互联网公司',
      phone: '13800138004',
      email: 'zhaoliu@example.com',
      address: '深圳市南山区科技园400号',
      level: 'IMPORTANT' as any,
      source: 'EXHIBITION' as any,
      notes: '在展会上了解产品,有意向采购',
      salesId: salesUser.id,
      status: 'ACTIVE' as any,
    },
    {
      name: '孙七',
      company: '杭州电商公司',
      phone: '13800138005',
      email: 'sunqi@example.com',
      address: '杭州市西湖区文三路500号',
      level: 'NORMAL' as any,
      source: null,
      notes: '之前联系过,但暂时不需要',
      salesId: salesUser.id,
      status: 'INACTIVE' as any,
    },
  ]

  for (const customer of customers) {
    try {
      await prisma.customer.create({
        data: customer
      })
      console.log(`✓ 创建客户: ${customer.name}`)
    } catch (error) {
      console.error(` 创建客户失败: ${customer.name}`, error)
    }
  }

  console.log('\n测试客户数据创建完成!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
