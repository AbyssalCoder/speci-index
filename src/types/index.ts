// ─── Core Application Types ─────────────────────────────────────

export type RarityTier = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';

export type SpeciesCategory =
  | 'MAMMAL' | 'BIRD' | 'REPTILE' | 'AMPHIBIAN' | 'FISH'
  | 'INSECT' | 'ARACHNID' | 'CRUSTACEAN' | 'MOLLUSK'
  | 'MARINE' | 'FLOWER' | 'FUNGI' | 'OTHER';

export type ConservationStatus = 'EX' | 'EW' | 'CR' | 'EN' | 'VU' | 'NT' | 'LC' | 'DD' | 'NE';

export type SubmissionStatus = 'PENDING' | 'PROCESSING' | 'ACCEPTED' | 'REJECTED' | 'FLAGGED' | 'UNDER_REVIEW';

export interface SpeciesInfo {
  id: string;
  scientificName: string;
  commonName: string;
  category: SpeciesCategory;
  conservationStatus: ConservationStatus;
  habitat: string | null;
  regions: string[];
  description: string | null;
  imageUrl: string | null;
  rarityPoints: number;
  rarityTier: RarityTier;
  globalPopulation: string | null;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string | null;
  state: string | null;
  totalPoints: number;
  speciesCount: number;
  level: number;
  xp: number;
}

export interface DiscoveryEntry {
  id: string;
  species: SpeciesInfo;
  firstSeenAt: string;
  pointsEarned: number;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  imageUrl: string;
}

export interface SubmissionResult {
  id: string;
  status: SubmissionStatus;
  species: SpeciesInfo | null;
  aiConfidence: number | null;
  aiRejectionReason: string | null;
  isFirstDiscovery: boolean;
  pointsAwarded: number;
  isRestrictedZone: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    country: string | null;
  };
  totalPoints: number;
  speciesCount: number;
}

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  species: {
    commonName: string;
    category: SpeciesCategory;
    rarityTier: RarityTier;
  };
  discoveredBy: string;
  discoveredAt: string;
}

export interface RestrictedZoneInfo {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  pointMultiplier: number;
}

export interface AchievementInfo {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl: string | null;
  category: string;
  rarity: RarityTier;
  unlockedAt?: string;
}

export interface QuestInfo {
  id: string;
  title: string;
  description: string;
  type: 'DAILY' | 'WEEKLY' | 'SEASONAL' | 'SPECIAL';
  requirement: Record<string, unknown>;
  xpReward: number;
  pointReward: number;
  progress: number;
  completed: boolean;
  endsAt: string;
}

export interface ClanInfo {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  avatarUrl: string | null;
  totalPoints: number;
  memberCount: number;
  maxMembers: number;
  isPublic: boolean;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

// ─── API Types ──────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── AI Service Types ───────────────────────────────────────────

export interface AIValidationResult {
  isValid: boolean;
  rejectionReason: string | null;
  species: {
    scientificName: string;
    commonName: string;
    confidence: number;
    category: SpeciesCategory;
  } | null;
  qualityScore: number;
  isHuman: boolean;
  isTree: boolean;
  isAIGenerated: boolean;
  isDuplicate: boolean;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  hasExif: boolean;
  exifData?: {
    make?: string;
    model?: string;
    dateTime?: string;
    gpsLatitude?: number;
    gpsLongitude?: number;
    software?: string;
  };
  perceptualHash: string;
}

// ─── Rarity Calculation ─────────────────────────────────────────

export interface RarityFactors {
  conservationStatus: ConservationStatus;
  globalObservationCount: number;
  regionRarity: number;
  seasonalBonus: number;
  eventMultiplier: number;
}
