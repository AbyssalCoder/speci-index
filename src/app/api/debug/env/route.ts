import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || 'NOT_SET';
  const directUrl = process.env.DIRECT_URL || 'NOT_SET';
  
  // Sanitize - only show host and port, mask password
  const sanitize = (url: string) => {
    if (url === 'NOT_SET') return url;
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.username}:***@${u.host}${u.pathname}${u.search}`;
    } catch {
      return `INVALID_URL (length: ${url.length})`;
    }
  };

  return NextResponse.json({
    DATABASE_URL: sanitize(dbUrl),
    DIRECT_URL: sanitize(directUrl),
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT_SET',
    SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT_SET',
  });
}
