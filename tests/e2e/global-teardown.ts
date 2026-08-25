import { cleanupE2EFixtures, prisma } from './support/database'


export default async function globalTeardown(): Promise<void> {
  try {
    await cleanupE2EFixtures()
  } finally {
    await prisma.$disconnect()
  }
}
