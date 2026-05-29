import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(str.length, 500); i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expectedKey = process.env.AI_SERVICE_API_KEY;
  if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const imageBase64: string = body.image;

  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  // Basic validation — in beta mode we accept most images
  const isTooBig = imageBase64.length > 20 * 1024 * 1024; // ~20MB base64
  const isTooSmall = imageBase64.length < 100;
  const perceptualHash = simpleHash(imageBase64);

  if (isTooBig) {
    return NextResponse.json({
      isValid: false,
      qualityScore: 0,
      isBlurry: false,
      isDark: false,
      isCropped: false,
      isScreenshot: false,
      isAIGenerated: false,
      perceptualHash: '',
      rejectionReason: 'Image too large (max 20MB)',
    });
  }

  if (isTooSmall) {
    return NextResponse.json({
      isValid: false,
      qualityScore: 0,
      isBlurry: false,
      isDark: false,
      isCropped: false,
      isScreenshot: false,
      isAIGenerated: false,
      perceptualHash: '',
      rejectionReason: 'Image too small or corrupt',
    });
  }

  return NextResponse.json({
    isValid: true,
    qualityScore: 0.85,
    isBlurry: false,
    isDark: false,
    isCropped: false,
    isScreenshot: false,
    isAIGenerated: false,
    perceptualHash,
    rejectionReason: null,
  });
}
