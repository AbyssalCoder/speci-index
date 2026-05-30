/**
 * AI Service — Multi-provider species identification.
 * Primary:  Groq Llama 4 Scout      (14,400 req/day per key, fastest)
 * Fallback: Google Gemini 2.0 Flash  (1,500 req/day free, high accuracy)
 *
 * Supports multiple Groq keys — comma-separate them in one env var:
 *   GROQ_API_KEY="key1,key2,key3"  → 43,200 req/day
 *
 * Env vars needed on Vercel:
 *   GROQ_API_KEY           — https://console.groq.com/keys (comma-separated for multiple)
 *   GOOGLE_GEMINI_API_KEY  — https://aistudio.google.com/apikey
 */

export interface IdentifyResult {
  species: {
    scientificName: string;
    commonName: string;
    confidence: number;
    category: string;
    conservationStatus: string | null;
    habitat: string | null;
    regions: string[];
    description: string | null;
    observationCount: number | null;
  } | null;
  confidence: number;
  isHuman: boolean;
  isTree: boolean;
  isAIGenerated: boolean;
  qualityScore: number;
  rejectionReason: string | null;
}

export interface ValidateResult {
  isValid: boolean;
  qualityScore: number;
  isBlurry: boolean;
  isDark: boolean;
  isCropped: boolean;
  isScreenshot: boolean;
  isAIGenerated: boolean;
  perceptualHash: string;
  rejectionReason: string | null;
}

const SPECIES_PROMPT = `You are a wildlife and species identification expert. Analyze this image and identify the species shown.

Respond with ONLY a valid JSON object (no markdown, no code fences) in this exact format:
{
  "identified": true,
  "isHuman": false,
  "isTree": false,
  "confidence": 0.92,
  "scientificName": "Felis catus",
  "commonName": "Domestic Cat",
  "category": "MAMMAL",
  "conservationStatus": "LC",
  "habitat": "Worldwide, domestic",
  "description": "A small domesticated carnivorous mammal with soft fur and retractile claws."
}

Rules:
- "category" must be one of: MAMMAL, BIRD, REPTILE, AMPHIBIAN, FISH, INSECT, ARACHNID, CRUSTACEAN, MOLLUSK, MARINE, FLOWER, FUNGI, OTHER
- "conservationStatus" must be one of: EX, EW, CR, EN, VU, NT, LC, DD, NE (use IUCN Red List status)
- "confidence" should be 0.0-1.0 representing how confident you are in the identification
- If a human is the primary subject, set "isHuman": true, "identified": false
- If it's a tree (not a flower/fruit/fungi on a tree), set "isTree": true, "identified": false
- If no living organism is clearly visible, set "identified": false with "confidence": 0
- If it's a pet/domestic animal, still identify it accurately (cats, dogs, hamsters, etc.)
- Be as specific as possible with the species identification
- For plants/flowers, use FLOWER category
- For mushrooms, use FUNGI category`;

// ─── Provider implementations ───────────────────────────────────────

async function callGemini(imageBase64: string): Promise<string> {
  const key = process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: SPECIES_PROMPT },
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`Gemini ${res.status}:`, err.slice(0, 300));
    throw new Error(`Gemini returned ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

async function callGroq(imageBase64: string, apiKey?: string): Promise<string> {
  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SPECIES_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Groq ${res.status}:`, err.slice(0, 300));
    throw new Error(`Groq returned ${res.status}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned empty response');
  return text;
}

// ─── Shared parser ──────────────────────────────────────────────────

const VALID_CATEGORIES = ['MAMMAL', 'BIRD', 'REPTILE', 'AMPHIBIAN', 'FISH', 'INSECT', 'ARACHNID', 'CRUSTACEAN', 'MOLLUSK', 'MARINE', 'FLOWER', 'FUNGI', 'OTHER'];
const VALID_STATUSES = ['EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE'];

function parseAIResponse(raw: string): IdentifyResult {
  const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const r = JSON.parse(jsonStr);

  if (r.isHuman) {
    return { species: null, confidence: r.confidence || 0.8, isHuman: true, isTree: false, isAIGenerated: false, qualityScore: 0.85, rejectionReason: null };
  }
  if (r.isTree) {
    return { species: null, confidence: r.confidence || 0.7, isHuman: false, isTree: true, isAIGenerated: false, qualityScore: 0.85, rejectionReason: null };
  }
  if (!r.identified || !r.scientificName) {
    return { species: null, confidence: r.confidence || 0, isHuman: false, isTree: false, isAIGenerated: false, qualityScore: 0.85, rejectionReason: 'Could not identify a species in this image' };
  }

  const confidence = Math.min(1, Math.max(0, r.confidence || 0.8));
  return {
    species: {
      scientificName: r.scientificName,
      commonName: r.commonName,
      confidence,
      category: VALID_CATEGORIES.includes(r.category) ? r.category : 'OTHER',
      conservationStatus: VALID_STATUSES.includes(r.conservationStatus) ? r.conservationStatus : 'LC',
      habitat: r.habitat || null,
      regions: [],
      description: r.description || null,
      observationCount: null,
    },
    confidence,
    isHuman: false,
    isTree: false,
    isAIGenerated: false,
    qualityScore: 0.85,
    rejectionReason: null,
  };
}

// ─── Main entry point (multi-provider with fallback) ────────────────

export async function identifySpecies(imageBase64: string): Promise<IdentifyResult> {
  const providers: { name: string; call: (b64: string) => Promise<string> }[] = [];

  // Add one provider per Groq key (comma-separated)
  const groqKeys = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  groqKeys.forEach((key, i) => {
    const label = groqKeys.length > 1 ? `Groq-${i + 1}` : 'Groq';
    providers.push({ name: label, call: (b64) => callGroq(b64, key) });
  });
  if (process.env.GOOGLE_GEMINI_API_KEY) providers.push({ name: 'Gemini', call: callGemini });

  if (providers.length === 0) {
    return {
      species: null, confidence: 0, isHuman: false, isTree: false,
      isAIGenerated: false, qualityScore: 0,
      rejectionReason: 'No AI provider configured. Set GOOGLE_GEMINI_API_KEY or GROQ_API_KEY.',
    };
  }

  for (const provider of providers) {
    try {
      console.log(`[AI] Trying ${provider.name}...`);
      const raw = await provider.call(imageBase64);
      const result = parseAIResponse(raw);
      console.log(`[AI] ${provider.name} identified: ${result.species?.commonName ?? 'none'} (${result.confidence})`);
      return result;
    } catch (err) {
      console.error(`[AI] ${provider.name} failed:`, err instanceof Error ? err.message : err);
      // Continue to next provider
    }
  }

  return {
    species: null, confidence: 0, isHuman: false, isTree: false,
    isAIGenerated: false, qualityScore: 0,
    rejectionReason: 'All AI providers failed. Please try again later.',
  };
}

// ─── Image validation ───────────────────────────────────────────────

function simpleHashHex(str: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(str.length, 500); i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

export async function validateImage(imageBase64: string): Promise<ValidateResult> {
  const isTooBig = imageBase64.length > 20 * 1024 * 1024;
  const isTooSmall = imageBase64.length < 100;
  const perceptualHash = simpleHashHex(imageBase64);

  if (isTooBig) {
    return {
      isValid: false, qualityScore: 0, isBlurry: false, isDark: false,
      isCropped: false, isScreenshot: false, isAIGenerated: false,
      perceptualHash: '', rejectionReason: 'Image too large (max 20MB)',
    };
  }

  if (isTooSmall) {
    return {
      isValid: false, qualityScore: 0, isBlurry: false, isDark: false,
      isCropped: false, isScreenshot: false, isAIGenerated: false,
      perceptualHash: '', rejectionReason: 'Image too small or corrupt',
    };
  }

  return {
    isValid: true, qualityScore: 0.85, isBlurry: false, isDark: false,
    isCropped: false, isScreenshot: false, isAIGenerated: false,
    perceptualHash, rejectionReason: null,
  };
}
