/**
 * Geofencing System
 * Detects restricted zones (zoos, safari parks, breeding centers, etc.)
 * and applies point multipliers accordingly.
 */

import { getAdminClient } from '@/lib/supabase/admin';
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
  const DEGREE_MARGIN = 0.5;
  const admin = getAdminClient();

  const { data: zones } = await admin
    .from('restricted_zones')
    .select('*')
    .eq('isActive', true)
    .gte('latitude', latitude - DEGREE_MARGIN)
    .lte('latitude', latitude + DEGREE_MARGIN)
    .gte('longitude', longitude - DEGREE_MARGIN)
    .lte('longitude', longitude + DEGREE_MARGIN);

  // Precise radius check
  for (const zone of zones ?? []) {
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
  const admin = getAdminClient();
  let query = admin.from('restricted_zones').select('*').eq('isActive', true);

  if (bounds) {
    query = query
      .gte('latitude', bounds.south)
      .lte('latitude', bounds.north)
      .gte('longitude', bounds.west)
      .lte('longitude', bounds.east);
  }

  const { data } = await query;
  return data ?? [];
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
