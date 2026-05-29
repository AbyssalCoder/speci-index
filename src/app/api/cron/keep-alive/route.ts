import { NextResponse } from 'next/server';

// Vercel Cron: runs every 5 minutes
// Pings Render AI service every call (so every 5 min — well under the 15min sleep threshold)
// Pings Supabase DB every call too (lightweight query to keep connection alive)

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  // Verify cron secret to prevent abuse
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, string> = {};

  // Ping Render AI service (keeps free tier alive — sleeps after 15 min inactivity)
  const aiUrl = process.env.AI_SERVICE_URL;
  if (aiUrl) {
    try {
      const res = await fetch(`${aiUrl}/health`, { signal: AbortSignal.timeout(10000) });
      results.render = res.ok ? 'ok' : `status ${res.status}`;
    } catch (e) {
      results.render = `error: ${(e as Error).message}`;
    }
  }

  // Ping Supabase DB (keeps free tier active — pauses after 1 week inactivity)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        signal: AbortSignal.timeout(10000),
      });
      results.supabase = res.ok ? 'ok' : `status ${res.status}`;
    } catch (e) {
      results.supabase = `error: ${(e as Error).message}`;
    }
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    pings: results,
  });
}
