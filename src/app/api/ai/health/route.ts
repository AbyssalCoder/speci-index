import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ status: 'ok', models_loaded: true, mode: 'beta-integrated' });
}
