import type { ConservationStatus, RarityTier, RarityFactors } from '@/types';

/**
 * Species Rarity Scoring Algorithm
 *
 * Factors:
 * 1. IUCN Conservation Status (primary weight)
 * 2. Global observation frequency (GBIF/iNaturalist data)
 * 3. Regional rarity modifier
 * 4. Seasonal bonuses
 * 5. Event multipliers
 *
 * Point Ranges:
 * - COMMON:    1 - 25
 * - UNCOMMON:  26 - 100
 * - RARE:      101 - 500
 * - EPIC:      501 - 2,000
 * - LEGENDARY: 2,001 - 10,000
 * - MYTHIC:    10,001+
 */

const CONSERVATION_BASE_SCORES: Record<ConservationStatus, number> = {
  LC: 5,      // Least Concern — very common
  NE: 8,      // Not Evaluated
  DD: 15,     // Data Deficient — some mystery value
  NT: 40,     // Near Threatened
  VU: 150,    // Vulnerable
  EN: 600,    // Endangered
  CR: 3000,   // Critically Endangered
  EW: 8000,   // Extinct in Wild
  EX: 15000,  // Extinct (if somehow photographed — verified fossils etc.)
};

/**
 * Calculate observation rarity multiplier.
 * Fewer global observations → higher multiplier.
 */
function observationMultiplier(count: number): number {
  if (count <= 0) return 5.0;       // Unknown / unobserved
  if (count < 10) return 4.0;       // Extremely rare sighting
  if (count < 100) return 3.0;
  if (count < 1000) return 2.0;
  if (count < 10000) return 1.5;
  if (count < 100000) return 1.2;
  if (count < 1000000) return 1.0;
  return 0.8;                        // Very common — slight reduction
}

/**
 * Calculate rarity points for a species.
 */
export function calculateRarityPoints(factors: RarityFactors): number {
  const base = CONSERVATION_BASE_SCORES[factors.conservationStatus] ?? 10;
  const obsMult = observationMultiplier(factors.globalObservationCount);
  const regionMult = Math.max(0.5, Math.min(3.0, factors.regionRarity));
  const seasonMult = Math.max(1.0, factors.seasonalBonus);
  const eventMult = Math.max(1.0, factors.eventMultiplier);

  const raw = base * obsMult * regionMult * seasonMult * eventMult;

  // Clamp to reasonable range
  return Math.max(1, Math.round(raw));
}

/**
 * Determine rarity tier from points.
 */
export function getRarityTierFromPoints(points: number): RarityTier {
  if (points >= 10001) return 'MYTHIC';
  if (points >= 2001) return 'LEGENDARY';
  if (points >= 501) return 'EPIC';
  if (points >= 101) return 'RARE';
  if (points >= 26) return 'UNCOMMON';
  return 'COMMON';
}

/**
 * Get base points from conservation status alone (used for quick estimates).
 */
export function getBasePointsFromStatus(status: ConservationStatus): number {
  return CONSERVATION_BASE_SCORES[status] ?? 10;
}

/**
 * Apply restricted zone modifier.
 * Returns adjusted points based on zone type.
 */
export function applyZoneModifier(points: number, zoneMultiplier: number): number {
  return Math.max(0, Math.round(points * zoneMultiplier));
}

/**
 * Example rarity calculations for reference:
 *
 * House Sparrow (LC, 50M+ observations):
 *   5 * 0.8 * 1.0 = 4 pts → COMMON
 *
 * King Cobra (VU, ~5000 observations):
 *   150 * 1.5 * 1.5 = 338 pts → RARE
 *
 * Snow Leopard (VU, ~1000 observations):
 *   150 * 2.0 * 2.5 = 750 pts → EPIC
 *
 * Amur Leopard (CR, ~100 observations):
 *   3000 * 3.0 * 2.0 = 18000 pts → MYTHIC
 *
 * Javan Rhino (CR, <50 observations):
 *   3000 * 4.0 * 3.0 = 36000 pts → MYTHIC
 */
