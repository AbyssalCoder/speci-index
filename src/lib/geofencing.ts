/**
 * Geofencing System
 * Detects restricted zones (zoos, safari parks, breeding centers, etc.)
 * and applies point multipliers accordingly.
 */

import { prisma } from '@/lib/db';
import { isInsideRadius } from '@/lib/utils';

interface ZoneCheckResult {
  isRestricted: boolean;
  zone: {
    id: string;
    name: string;
    type: string;
  } | null;
  pointMultiplier: number;
}

/**
 * Check if coordinates fall within any restricted zone.
 */
export async function checkRestrictedZone(
  latitude: number,
  longitude: number
): Promise<ZoneCheckResult> {
  // Query zones within a rough bounding box first (performance optimization)
  const DEGREE_MARGIN = 0.5; // ~55km rough filter

  const zones = await prisma.restrictedZone.findMany({
    where: {
      isActive: true,
      latitude: {
        gte: latitude - DEGREE_MARGIN,
        lte: latitude + DEGREE_MARGIN,
      },
      longitude: {
        gte: longitude - DEGREE_MARGIN,
        lte: longitude + DEGREE_MARGIN,
      },
    },
  });

  // Precise radius check
  for (const zone of zones) {
    if (isInsideRadius(latitude, longitude, zone.latitude, zone.longitude, zone.radiusMeters)) {
      return {
        isRestricted: true,
        zone: {
          id: zone.id,
          name: zone.name,
          type: zone.type,
        },
        pointMultiplier: zone.pointMultiplier,
      };
    }
  }

  return {
    isRestricted: false,
    zone: null,
    pointMultiplier: 1.0,
  };
}

/**
 * Get all restricted zones for map display.
 */
export async function getRestrictedZones(bounds?: {
  south: number;
  north: number;
  west: number;
  east: number;
}) {
  const where: Record<string, unknown> = { isActive: true };

  if (bounds) {
    where.latitude = { gte: bounds.south, lte: bounds.north };
    where.longitude = { gte: bounds.west, lte: bounds.east };
  }

  return prisma.restrictedZone.findMany({ where });
}

/**
 * Seed initial restricted zones (major zoos worldwide).
 * In production, this would be maintained via admin dashboard.
 */
export const INITIAL_RESTRICTED_ZONES = [
  { name: "San Diego Zoo", type: "ZOO", latitude: 32.7353, longitude: -117.1490, radiusMeters: 500, pointMultiplier: 0 },
  { name: "London Zoo", type: "ZOO", latitude: 51.5353, longitude: -0.1534, radiusMeters: 400, pointMultiplier: 0 },
  { name: "Singapore Zoo", type: "ZOO", latitude: 1.4043, longitude: 103.7930, radiusMeters: 600, pointMultiplier: 0 },
  { name: "Bronx Zoo", type: "ZOO", latitude: 40.8506, longitude: -73.8769, radiusMeters: 1000, pointMultiplier: 0 },
  { name: "Beijing Zoo", type: "ZOO", latitude: 39.9399, longitude: 116.3380, radiusMeters: 500, pointMultiplier: 0 },
  { name: "Berlin Zoo", type: "ZOO", latitude: 52.5079, longitude: 13.3377, radiusMeters: 400, pointMultiplier: 0 },
  { name: "Toronto Zoo", type: "ZOO", latitude: 43.8175, longitude: -79.1853, radiusMeters: 700, pointMultiplier: 0 },
  { name: "Melbourne Zoo", type: "ZOO", latitude: -37.7842, longitude: 144.9517, radiusMeters: 400, pointMultiplier: 0 },
  { name: "National Zoological Park Delhi", type: "ZOO", latitude: 28.6062, longitude: 77.2416, radiusMeters: 400, pointMultiplier: 0 },
  { name: "Kruger National Park", type: "SAFARI_PARK", latitude: -23.9884, longitude: 31.5547, radiusMeters: 50000, pointMultiplier: 0.1 },
  { name: "Monterey Bay Aquarium", type: "AQUARIUM", latitude: 36.6183, longitude: -121.9018, radiusMeters: 200, pointMultiplier: 0 },
  { name: "Georgia Aquarium", type: "AQUARIUM", latitude: 33.7634, longitude: -84.3951, radiusMeters: 200, pointMultiplier: 0 },
  { name: "SeaWorld Orlando", type: "EXHIBIT", latitude: 28.4114, longitude: -81.4612, radiusMeters: 500, pointMultiplier: 0 },
];
