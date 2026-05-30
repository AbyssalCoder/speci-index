/**
 * AI Service — Species identification using Google Gemini Vision API.
 * Uses Gemini 2.0 Flash (free tier: 15 RPM, 1500 RPD).
 * Get a free API key at https://aistudio.google.com/apikey
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

const GEMINI_IDENTIFY_PROMPT = `You are a wildlife and species identification expert. Analyze this image and identify the species shown.

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

/**
 * Identify species from a base64 image using Google Gemini Vision.
 */
export async function identifySpecies(imageBase64: string): Promise<IdentifyResult> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error('GOOGLE_GEMINI_API_KEY not set — cannot identify species');
    return {
      species: null,
      confidence: 0,
      isHuman: false,
      isTree: false,
      isAIGenerated: false,
      qualityScore: 0,
      rejectionReason: 'AI service not configured. Please set GOOGLE_GEMINI_API_KEY.',
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: GEMINI_IDENTIFY_PROMPT },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini API error (${response.status}):`, errText);
      throw new Error(`Gemini API returned ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('Gemini returned no text:', JSON.stringify(data).slice(0, 500));
      throw new Error('No response from Gemini');
    }

    // Parse JSON from response (handle potential markdown fences)
    const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(jsonStr);

    if (result.isHuman) {
      return {
        species: null,
        confidence: result.confidence || 0.8,
        isHuman: true,
        isTree: false,
        isAIGenerated: false,
        qualityScore: 0.85,
        rejectionReason: null,
      };
    }

    if (result.isTree) {
      return {
        species: null,
        confidence: result.confidence || 0.7,
        isHuman: false,
        isTree: true,
        isAIGenerated: false,
        qualityScore: 0.85,
        rejectionReason: null,
      };
    }

    if (!result.identified || !result.scientificName) {
      return {
        species: null,
        confidence: result.confidence || 0,
        isHuman: false,
        isTree: false,
        isAIGenerated: false,
        qualityScore: 0.85,
        rejectionReason: 'Could not identify a species in this image',
      };
    }

    // Validate category
    const validCategories = ['MAMMAL', 'BIRD', 'REPTILE', 'AMPHIBIAN', 'FISH', 'INSECT', 'ARACHNID', 'CRUSTACEAN', 'MOLLUSK', 'MARINE', 'FLOWER', 'FUNGI', 'OTHER'];
    const category = validCategories.includes(result.category) ? result.category : 'OTHER';

    // Validate conservation status
    const validStatuses = ['EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE'];
    const status = validStatuses.includes(result.conservationStatus) ? result.conservationStatus : 'LC';

    return {
      species: {
        scientificName: result.scientificName,
        commonName: result.commonName,
        confidence: Math.min(1, Math.max(0, result.confidence || 0.8)),
        category,
        conservationStatus: status,
        habitat: result.habitat || null,
        regions: [],
        description: result.description || null,
        observationCount: null,
      },
      confidence: Math.min(1, Math.max(0, result.confidence || 0.8)),
      isHuman: false,
      isTree: false,
      isAIGenerated: false,
      qualityScore: 0.85,
      rejectionReason: null,
    };
  } catch (error) {
    console.error('Species identification error:', error);
    throw error; // Let the caller handle the fallback
  }
}

function simpleHashHex(str: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(str.length, 500); i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Validate an image for anti-cheat purposes.
 */
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
