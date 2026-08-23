import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({ 
    select: { 
      id: true, 
      username: true, 
      realName: true 
    }
  })
  
  console.log('Database users:')
  users.forEach(u => {
    console.log(`  - ${u.username} (${u.realName}): ID = ${u.id}`)
  })
  
  await prisma.$disconnect()
}

main()
