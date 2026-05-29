import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('🌱 Seeding database...');

  // ── Achievements ─────────────────────────────────────────────
  const achievements = [
    { slug: 'first-catch', name: 'First Catch', description: 'Discover your first species', category: 'DISCOVERY' as const, rarity: 'COMMON' as const, xpReward: 50, pointReward: 25, requirement: { type: 'discovery_count', count: 1 } },
    { slug: 'budding-biologist', name: 'Budding Biologist', description: 'Discover 10 species', category: 'DISCOVERY' as const, rarity: 'UNCOMMON' as const, xpReward: 200, pointReward: 100, requirement: { type: 'discovery_count', count: 10 } },
    { slug: 'field-researcher', name: 'Field Researcher', description: 'Discover 50 species', category: 'DISCOVERY' as const, rarity: 'RARE' as const, xpReward: 500, pointReward: 300, requirement: { type: 'discovery_count', count: 50 } },
    { slug: 'naturalist', name: 'Naturalist', description: 'Discover 100 species', category: 'DISCOVERY' as const, rarity: 'EPIC' as const, xpReward: 1000, pointReward: 750, requirement: { type: 'discovery_count', count: 100 } },
    { slug: 'master-taxonomist', name: 'Master Taxonomist', description: 'Discover 500 species', category: 'DISCOVERY' as const, rarity: 'LEGENDARY' as const, xpReward: 5000, pointReward: 3000, requirement: { type: 'discovery_count', count: 500 } },
    { slug: 'living-encyclopedia', name: 'Living Encyclopedia', description: 'Discover 1000 species', category: 'DISCOVERY' as const, rarity: 'MYTHIC' as const, xpReward: 15000, pointReward: 10000, requirement: { type: 'discovery_count', count: 1000 } },
    { slug: 'flower-power', name: 'Flower Power', description: 'Discover 10 flower species', category: 'COLLECTION' as const, rarity: 'UNCOMMON' as const, xpReward: 150, pointReward: 75, requirement: { type: 'category_count', category: 'FLOWER', count: 10 } },
    { slug: 'fungi-forager', name: 'Fungi Forager', description: 'Discover 10 fungi species', category: 'COLLECTION' as const, rarity: 'UNCOMMON' as const, xpReward: 150, pointReward: 75, requirement: { type: 'category_count', category: 'FUNGI', count: 10 } },
    { slug: 'bird-watcher', name: 'Bird Watcher', description: 'Discover 20 bird species', category: 'COLLECTION' as const, rarity: 'RARE' as const, xpReward: 300, pointReward: 150, requirement: { type: 'category_count', category: 'BIRD', count: 20 } },
    { slug: 'insect-collector', name: 'Insect Collector', description: 'Discover 20 insect species', category: 'COLLECTION' as const, rarity: 'RARE' as const, xpReward: 300, pointReward: 150, requirement: { type: 'category_count', category: 'INSECT', count: 20 } },
    { slug: 'marine-biologist', name: 'Marine Biologist', description: 'Discover 15 marine species', category: 'COLLECTION' as const, rarity: 'RARE' as const, xpReward: 300, pointReward: 150, requirement: { type: 'category_count', category: 'MARINE', count: 15 } },
    { slug: 'rare-find', name: 'Rare Find', description: 'Discover a RARE species', category: 'DISCOVERY' as const, rarity: 'RARE' as const, xpReward: 250, pointReward: 125, requirement: { type: 'rarity_discovery', rarity: 'RARE', count: 1 } },
    { slug: 'epic-discovery', name: 'Epic Discovery', description: 'Discover an EPIC species', category: 'DISCOVERY' as const, rarity: 'EPIC' as const, xpReward: 500, pointReward: 300, requirement: { type: 'rarity_discovery', rarity: 'EPIC', count: 1 } },
    { slug: 'legendary-hunter', name: 'Legendary Hunter', description: 'Discover a LEGENDARY species', category: 'DISCOVERY' as const, rarity: 'LEGENDARY' as const, xpReward: 2000, pointReward: 1500, requirement: { type: 'rarity_discovery', rarity: 'LEGENDARY', count: 1 } },
    { slug: 'myth-seeker', name: 'Myth Seeker', description: 'Discover a MYTHIC species', category: 'DISCOVERY' as const, rarity: 'MYTHIC' as const, xpReward: 10000, pointReward: 7500, requirement: { type: 'rarity_discovery', rarity: 'MYTHIC', count: 1 } },
    { slug: 'globe-trotter', name: 'Globe Trotter', description: 'Discover species in 3 different countries', category: 'EXPLORATION' as const, rarity: 'RARE' as const, xpReward: 400, pointReward: 200, requirement: { type: 'country_count', count: 3 } },
    { slug: 'world-explorer', name: 'World Explorer', description: 'Discover species in 10 different countries', category: 'EXPLORATION' as const, rarity: 'LEGENDARY' as const, xpReward: 3000, pointReward: 2000, requirement: { type: 'country_count', count: 10 } },
    { slug: 'social-butterfly', name: 'Social Butterfly', description: 'Add 5 friends', category: 'SOCIAL' as const, rarity: 'UNCOMMON' as const, xpReward: 100, pointReward: 50, requirement: { type: 'friend_count', count: 5 } },
    { slug: 'clan-leader', name: 'Clan Leader', description: 'Create a clan', category: 'SOCIAL' as const, rarity: 'RARE' as const, xpReward: 300, pointReward: 150, requirement: { type: 'clan_create', count: 1 } },
  ];

  for (const a of achievements) {
    await prisma.achievement.upsert({
      where: { slug: a.slug },
      update: { name: a.name, description: a.description, category: a.category, rarity: a.rarity, xpReward: a.xpReward, pointReward: a.pointReward, requirement: a.requirement },
      create: a,
    });
  }
  console.log(`  ✅ ${achievements.length} achievements seeded`);

  // ── Quests ───────────────────────────────────────────────────
  const now = new Date();
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(now); endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay())); endOfWeek.setHours(23, 59, 59, 999);

  const quests = [
    { title: 'Daily Discovery', description: 'Discover any species today', type: 'DAILY' as const, requirement: { type: 'discovery_count', count: 1 }, xpReward: 50, pointReward: 25, startsAt: now, endsAt: endOfDay },
    { title: 'Triple Threat', description: 'Discover 3 different species today', type: 'DAILY' as const, requirement: { type: 'discovery_count', count: 3 }, xpReward: 150, pointReward: 75, startsAt: now, endsAt: endOfDay },
    { title: 'Weekly Wanderer', description: 'Discover 10 species this week', type: 'WEEKLY' as const, requirement: { type: 'discovery_count', count: 10 }, xpReward: 500, pointReward: 250, startsAt: now, endsAt: endOfWeek },
    { title: 'Category Explorer', description: 'Discover species from 3 different categories this week', type: 'WEEKLY' as const, requirement: { type: 'category_variety', count: 3 }, xpReward: 300, pointReward: 150, startsAt: now, endsAt: endOfWeek },
    { title: 'Flora Finder', description: 'Discover 5 flower species', type: 'WEEKLY' as const, requirement: { type: 'category_count', category: 'FLOWER', count: 5 }, xpReward: 200, pointReward: 100, startsAt: now, endsAt: endOfWeek },
  ];

  for (const q of quests) {
    const existing = await prisma.quest.findFirst({ where: { title: q.title, type: q.type } });
    if (!existing) {
      await prisma.quest.create({ data: q });
    }
  }
  console.log(`  ✅ ${quests.length} quests seeded`);

  // ── Restricted Zones ─────────────────────────────────────────
  const restrictedZones = [
    { name: 'San Diego Zoo', type: 'ZOO' as const, latitude: 32.7353, longitude: -117.1490, radiusMeters: 500, pointMultiplier: 0 },
    { name: 'Bronx Zoo', type: 'ZOO' as const, latitude: 40.8506, longitude: -73.8770, radiusMeters: 400, pointMultiplier: 0 },
    { name: 'London Zoo', type: 'ZOO' as const, latitude: 51.5353, longitude: -0.1534, radiusMeters: 300, pointMultiplier: 0 },
    { name: 'Singapore Zoo', type: 'ZOO' as const, latitude: 1.4043, longitude: 103.7930, radiusMeters: 400, pointMultiplier: 0 },
    { name: 'Berlin Zoo', type: 'ZOO' as const, latitude: 52.5079, longitude: 13.3377, radiusMeters: 300, pointMultiplier: 0 },
    { name: 'Taronga Zoo', type: 'ZOO' as const, latitude: -33.8433, longitude: 151.2411, radiusMeters: 350, pointMultiplier: 0 },
    { name: 'Smithsonian National Zoo', type: 'ZOO' as const, latitude: 38.9296, longitude: -77.0499, radiusMeters: 400, pointMultiplier: 0 },
    { name: 'Georgia Aquarium', type: 'AQUARIUM' as const, latitude: 33.7634, longitude: -84.3951, radiusMeters: 200, pointMultiplier: 0 },
    { name: 'Monterey Bay Aquarium', type: 'AQUARIUM' as const, latitude: 36.6183, longitude: -121.9018, radiusMeters: 200, pointMultiplier: 0 },
    { name: 'Toronto Zoo', type: 'ZOO' as const, latitude: 43.8176, longitude: -79.1856, radiusMeters: 500, pointMultiplier: 0 },
    { name: 'Ueno Zoo', type: 'ZOO' as const, latitude: 35.7164, longitude: 139.7718, radiusMeters: 300, pointMultiplier: 0 },
    { name: 'Beijing Zoo', type: 'ZOO' as const, latitude: 39.9399, longitude: 116.3378, radiusMeters: 400, pointMultiplier: 0 },
    { name: 'Melbourne Zoo', type: 'ZOO' as const, latitude: -37.7840, longitude: 144.9516, radiusMeters: 300, pointMultiplier: 0 },
  ];

  for (const z of restrictedZones) {
    const existing = await prisma.restrictedZone.findFirst({ where: { name: z.name } });
    if (!existing) {
      await prisma.restrictedZone.create({ data: z });
    }
  }
  console.log(`  ✅ ${restrictedZones.length} restricted zones seeded`);

  // ── Initial Season ───────────────────────────────────────────
  const seasonExists = await prisma.season.findFirst({ where: { name: 'Season 1 — Genesis' } });
  if (!seasonExists) {
    await prisma.season.create({
      data: {
        name: 'Season 1 — Genesis',
        description: 'The inaugural season of Speci-Index',
        startsAt: new Date('2025-01-01'),
        endsAt: new Date('2025-06-30'),
        isActive: true,
      },
    });
  }
  console.log('  ✅ Season 1 seeded');

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
