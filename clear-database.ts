import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️ Clearing database...')
  
  await prisma.payment.deleteMany()
  await prisma.order.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.dailyReport.deleteMany()
  await prisma.task.deleteMany()
  
  console.log('✅ Database cleared successfully!')
  
  await prisma.$disconnect()
}

main()
