import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '50'));

    // Single species lookup
    if (id) {
      const { data: species, error } = await supabase
        .from('species')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!species) {
        return NextResponse.json({ success: false, error: 'Species not found' }, { status: 404 });
      }

      const { count: discoveryCount, error: countError } = await supabase
        .from('discoveries')
        .select('*', { count: 'exact', head: true })
        .eq('speciesId', id);

      if (countError) throw countError;

      return NextResponse.json({
        success: true,
        data: { ...species, discoveryCount: discoveryCount ?? 0 },
      });
    }

    // List / search
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('species')
      .select('*', { count: 'exact' })
      .order('commonName', { ascending: true })
      .range(from, to);

    if (category) {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.or(`commonName.ilike.%${search}%,scientificName.ilike.%${search}%`);
    }

    const { data: items, count: total, error } = await query;
    if (error) throw error;

    const totalCount = total ?? 0;

    return NextResponse.json({
      success: true,
      data: { items: items ?? [], total: totalCount, page, pageSize, hasMore: page * pageSize < totalCount },
    });
  } catch (error) {
    console.error('Species error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
