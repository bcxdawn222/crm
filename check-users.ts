import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, username: true, realName: true } })
  console.log('Users:', JSON.stringify(users, null, 2))
  
  await prisma.$disconnect()
}

main()
