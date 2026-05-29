import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'));

    // Single species lookup
    if (id) {
      const species = await prisma.species.findUnique({ where: { id } });
      if (!species) {
        return NextResponse.json({ success: false, error: 'Species not found' }, { status: 404 });
      }
      const discoveryCount = await prisma.discovery.count({ where: { speciesId: id } });
      return NextResponse.json({
        success: true,
        data: { ...species, discoveryCount },
      });
    }

    // List / search
    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { commonName: { contains: search, mode: 'insensitive' } },
        { scientificName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.species.findMany({
        where,
        orderBy: { commonName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.species.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: { items, total, page, pageSize, hasMore: page * pageSize < total },
    });
  } catch (error) {
    console.error('Species error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
