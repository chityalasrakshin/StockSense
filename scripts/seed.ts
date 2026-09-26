import { PrismaClient, Role, LocationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding baseline StockSense data...');

  // Create demo manager
  const manager = await prisma.user.upsert({
    where: { email: 'manager@stocksense.local' },
    update: {},
    create: {
      email: 'manager@stocksense.local',
      passwordHash: '$2b$10$ep/0tT0nKq3fGzN4/eZseeg5e1PcvbK/m85yLqgLsqYkWgNnQkH9q', // password123
      role: Role.INVENTORY_MANAGER,
    },
  });

  // Create demo staff
  const staff = await prisma.user.upsert({
    where: { email: 'staff@stocksense.local' },
    update: {},
    create: {
      email: 'staff@stocksense.local',
      passwordHash: '$2b$10$ep/0tT0nKq3fGzN4/eZseeg5e1PcvbK/m85yLqgLsqYkWgNnQkH9q',
      role: Role.WAREHOUSE_STAFF,
    },
  });

  // Create main warehouse
  const mainWarehouse = await prisma.location.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Main Central Warehouse',
      type: LocationType.WAREHOUSE,
    },
  });

  console.log(
    `Seeding complete: Created users (${manager.email}, ${staff.email}) and warehouse (${mainWarehouse.name}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
