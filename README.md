# 🧬 Speci-Index

> Discover and collect real-world species like Pokémon! A mobile-first multiplayer web app that gamifies biodiversity observation.

## Overview

Speci-Index turns nature exploration into an addictive collection game. Snap photos of real plants, animals, insects, and fungi — AI identifies the species, assigns rarity points based on conservation status, and adds it to your personal Speci-Index. Compete on leaderboards, join clans, complete quests, and earn achievements.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript 5.7 |
| Styling | Tailwind CSS 3.4, Framer Motion 11 |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 6 |
| Auth | Supabase Auth (email + Google OAuth) |
| Storage | Supabase Storage |
| State | Zustand 5 |
| Maps | MapLibre GL + OpenStreetMap |
| AI | Python FastAPI + BioCLIP (species identification) |
| Deployment | Vercel (web) + Docker (AI service) |

## Features

- 📸 **Camera Capture** — Snap photos using your phone camera with GPS tagging
- 🤖 **AI Identification** — BioCLIP-powered species recognition with confidence scoring
- 🗺️ **Interactive Map** — Explore discoveries on an OpenStreetMap-based map
- 🏆 **Leaderboards** — Global, country, state, and friends rankings
- 👥 **Social** — Friends, clans, and team competitions
- 📜 **Quests & Achievements** — Daily/weekly quests and 20+ achievements
- 🛡️ **Anti-Cheat** — EXIF validation, GPS spoof detection, perceptual hashing, fraud scoring
- 🚫 **Geofencing** — Blocks submissions from zoos and aquariums
- 📱 **PWA** — Installable, works offline, mobile-first design
- ⚡ **Admin Dashboard** — Moderation tools, report management, user bans

## Rarity System

Species rarity is calculated from real conservation data:

| Tier | Points | Examples |
|------|--------|---------|
| COMMON | 1–24 | House sparrow, dandelion |
| UNCOMMON | 25–99 | Red fox, chanterelle |
| RARE | 100–499 | Owl species, orchids |
| EPIC | 500–1999 | Endangered animals |
| LEGENDARY | 2000–9999 | Critically endangered |
| MYTHIC | 10000+ | Functionally extinct species |

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+ (for AI service)
- Supabase account (free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/speci-index.git
cd speci-index
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Fill in your Supabase credentials and generate an AI service API key.

### 3. Database Setup

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. AI Service (separate terminal)

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 6. Open

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (app)/             # Authenticated app pages
│   │   │   ├── dashboard/     # Main dashboard
│   │   │   ├── collection/    # Species collection browser
│   │   │   ├── map/           # Interactive discovery map
│   │   │   ├── leaderboard/   # Rankings
│   │   │   ├── social/        # Friends & clans
│   │   │   ├── achievements/  # Achievement showcase
│   │   │   ├── profile/       # User profile
│   │   │   ├── notifications/ # Notification center
│   │   │   ├── admin/         # Admin moderation panel
│   │   │   └── species/[id]/  # Species detail page
│   │   ├── (auth)/            # Login/signup pages
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── ui/                # Reusable UI components
│   │   ├── species/           # Species cards, rarity badges
│   │   ├── capture/           # Camera capture modal
│   │   └── layout/            # Navigation, top bar
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Core utilities
│   │   ├── supabase/          # Supabase client config
│   │   ├── anticheat.ts       # Anti-cheat validation
│   │   ├── geofencing.ts      # Restricted zone checks
│   │   ├── rarity.ts          # Rarity scoring algorithm
│   │   └── utils.ts           # Helpers
│   ├── stores/                # Zustand state stores
│   └── types/                 # TypeScript types
├── ai-service/                # Python AI microservice
│   ├── main.py                # FastAPI app
│   ├── services/              # BioCLIP, image validation, fraud detection
│   ├── Dockerfile
│   └── requirements.txt
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data
├── public/                    # Static assets & PWA manifest
└── docker-compose.yml         # Local development with Docker
```

## Deployment

### Frontend → Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### AI Service → Railway / Render / Fly.io

```bash
cd ai-service
docker build -t speci-ai .
# Deploy to your preferred container host
```

### Database → Supabase

Already hosted. Run migrations with `npx prisma db push`.

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Enable **Email** and **Google** auth providers
3. Create a storage bucket named `submissions` (public)
4. Copy project URL and keys to `.env`

## Future Roadmap

- **Seasonal Events** — Time-limited species and themed challenges
- **AR Mode** — Augmented reality species overlay
- **Trading System** — Trade discovery NFTs with other players
- **Biome System** — Desert, forest, ocean biome tracking
- **Sound Identification** — Bird call recognition
- **Community Challenges** — Server-wide discovery goals
- **Species Wiki** — Community-contributed species info
- **Mobile App** — React Native companion app

## License

MIT
