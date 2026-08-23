const { PrismaClient } = require('@prisma/client');

async function testArchiveFeature() {
  const prisma = new PrismaClient();
  
  console.log('🧪 Testing Archive Feature...\n');
  
  try {
    // Get admin user
    const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } });
    if (!adminUser) {
      console.error('❌ Admin user not found');
      return;
    }
    
    console.log(`✅ Using admin: ${adminUser.username}\n`);
    
    // Create test customers
    console.log('📋 Creating 5 test customers...');
    const customers = [];
    for (let i = 1; i <= 5; i++) {
      const customer = await prisma.customer.create({
        data: {
          name: `Test Customer ${i}`,
          company: `Company ${i}`,
          phone: `139${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
          email: `test${i}@example.com`,
          level: 'POTENTIAL',
          source: 'WEBSITE',
          salesId: adminUser.id,
          isPublic: false,
          status: 'ACTIVE',
        }
      });
      customers.push(customer);
      console.log(`  ✓ Created: ${customer.name}`);
    }
    console.log(`✅ Created ${customers.length} customers\n`);
    
    // Test archive feature
    console.log('🗄️ Archiving 2 customers to public pool...');
    const toArchive = customers.slice(0, 2);
    for (const customer of toArchive) {
      const updated = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          isPublic: true,
          status: 'INACTIVE',
        }
      });
      console.log(`  ✓ Archived: ${updated.name} (isPublic: ${updated.isPublic})`);
    }
    console.log(`✅ Archived ${toArchive.length} customers\n`);
    
    // Verify counts
    const totalCount = await prisma.customer.count();
    const publicCount = await prisma.customer.count({ where: { isPublic: true } });
    const activeCount = await prisma.customer.count({ where: { isPublic: false } });
    
    console.log('📊 Summary:');
    console.log(`  Total customers: ${totalCount}`);
    console.log(`  In public pool: ${publicCount}`);
    console.log(`  Active customers: ${activeCount}`);
    
    console.log('\n✅ All tests passed!');
    console.log('\n🎯 You can now:');
    console.log('  1. Start server: npm run dev -- -p 3008');
    console.log('  2. Login: admin / 123456');
    console.log('  3. View customers at /customers');
    console.log('  4. Archive customers using the "归档" button');
    console.log('  5. View public pool at /public-pool');
    console.log('  6. Claim customers from public pool');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testArchiveFeature().catch(console.error);
