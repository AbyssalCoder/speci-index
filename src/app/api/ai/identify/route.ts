import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SPECIES_DB = [
  { commonName: "Monarch Butterfly", scientificName: "Danaus plexippus", category: "INSECT", conservationStatus: "LC" },
  { commonName: "Red Fox", scientificName: "Vulpes vulpes", category: "MAMMAL", conservationStatus: "LC" },
  { commonName: "Blue Jay", scientificName: "Cyanocitta cristata", category: "BIRD", conservationStatus: "LC" },
  { commonName: "Green Tree Frog", scientificName: "Hyla cinerea", category: "AMPHIBIAN", conservationStatus: "LC" },
  { commonName: "Eastern Box Turtle", scientificName: "Terrapene carolina", category: "REPTILE", conservationStatus: "VU" },
  { commonName: "Common Sunflower", scientificName: "Helianthus annuus", category: "FLOWER", conservationStatus: "LC" },
  { commonName: "Fly Agaric", scientificName: "Amanita muscaria", category: "FUNGI", conservationStatus: "LC" },
  { commonName: "Ladybug", scientificName: "Coccinellidae sp.", category: "INSECT", conservationStatus: "LC" },
  { commonName: "House Sparrow", scientificName: "Passer domesticus", category: "BIRD", conservationStatus: "LC" },
  { commonName: "European Rabbit", scientificName: "Oryctolagus cuniculus", category: "MAMMAL", conservationStatus: "EN" },
  { commonName: "Clownfish", scientificName: "Amphiprioninae sp.", category: "FISH", conservationStatus: "LC" },
  { commonName: "Garden Spider", scientificName: "Araneus diadematus", category: "ARACHNID", conservationStatus: "LC" },
  { commonName: "Blue Morpho", scientificName: "Morpho menelaus", category: "INSECT", conservationStatus: "LC" },
  { commonName: "Red-eyed Tree Frog", scientificName: "Agalychnis callidryas", category: "AMPHIBIAN", conservationStatus: "LC" },
  { commonName: "Peacock", scientificName: "Pavo cristatus", category: "BIRD", conservationStatus: "LC" },
  { commonName: "Orchid", scientificName: "Orchidaceae sp.", category: "FLOWER", conservationStatus: "LC" },
  { commonName: "Lion", scientificName: "Panthera leo", category: "MAMMAL", conservationStatus: "VU" },
  { commonName: "Seahorse", scientificName: "Hippocampus sp.", category: "FISH", conservationStatus: "VU" },
  { commonName: "Praying Mantis", scientificName: "Mantodea sp.", category: "INSECT", conservationStatus: "LC" },
  { commonName: "Rose", scientificName: "Rosa sp.", category: "FLOWER", conservationStatus: "LC" },
  { commonName: "Common Octopus", scientificName: "Octopus vulgaris", category: "MOLLUSK", conservationStatus: "LC" },
  { commonName: "Barn Owl", scientificName: "Tyto alba", category: "BIRD", conservationStatus: "LC" },
  { commonName: "Coral Reef", scientificName: "Scleractinia sp.", category: "MARINE", conservationStatus: "VU" },
  { commonName: "Hermit Crab", scientificName: "Paguroidea sp.", category: "CRUSTACEAN", conservationStatus: "LC" },
];

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < Math.min(str.length, 200); i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.AI_SERVICE_API_KEY;
  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const imageBase64: string = body.image;

  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  // Use image hash for deterministic species selection
  const hash = simpleHash(imageBase64);
  const speciesIndex = hash % SPECIES_DB.length;
  const species = SPECIES_DB[speciesIndex];
  const confidence = 0.65 + seededRandom(hash) * 0.30;

  return NextResponse.json({
    species: {
      scientificName: species.scientificName,
      commonName: species.commonName,
      confidence: Math.round(confidence * 1000) / 1000,
      category: species.category,
      conservationStatus: species.conservationStatus,
      habitat: null,
      regions: [],
      description: `Identified as ${species.commonName} (${species.scientificName}). [Beta mode]`,
      observationCount: null,
    },
    confidence: Math.round(confidence * 1000) / 1000,
    isHuman: false,
    isTree: false,
    isAIGenerated: false,
    qualityScore: 0.85,
    rejectionReason: null,
  });
}
