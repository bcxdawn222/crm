import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const count = await prisma.customer.count()
  console.log('数据库中客户总数:', count)
  
  // 显示最近的5个客户
  const recentCustomers = await prisma.customer.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      name: true,
      company: true,
      phone: true,
      level: true,
      source: true,
    }
  })
  
  console.log('\n最近添加的5个客户:')
  recentCustomers.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name} - ${c.company} - ${c.phone}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
