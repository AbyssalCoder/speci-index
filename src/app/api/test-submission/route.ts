import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { identifySpecies, validateImage } from '@/lib/ai-service';
import { validateSubmission } from '@/lib/anticheat';
import { calculateRarityPoints, getRarityTierFromPoints } from '@/lib/rarity';

export const maxDuration = 60;

// Temporary test endpoint — remove after verification
export async function POST(req: NextRequest) {
  const steps: string[] = [];

  try {
    steps.push('1. Parsing request body');
    const body = await req.json();
    const imageBase64 = body.imageBase64 || '';
    steps.push(`   Image base64 length: ${imageBase64.length}`);

    if (!imageBase64 || imageBase64.length < 10) {
      return NextResponse.json({ steps, error: 'No image provided' });
    }

    steps.push('2. Testing AI validateImage()');
    const validation = await validateImage(imageBase64);
    steps.push(`   isValid: ${validation.isValid}, hash: ${validation.perceptualHash}`);

    steps.push('3. Testing AI identifySpecies()');
    const aiResult = await identifySpecies(imageBase64);
    steps.push(`   species: ${aiResult.species?.commonName}, confidence: ${aiResult.confidence}`);
    steps.push(`   isHuman: ${aiResult.isHuman}, isTree: ${aiResult.isTree}`);

    if (!aiResult.species || aiResult.confidence < 0.7) {
      steps.push('   *** REJECTED: Low confidence or no species');
      return NextResponse.json({ steps, aiResult, rejected: true });
    }

    steps.push('4. Testing admin client (Supabase)');
    const admin = getAdminClient();
    const { data: testUser, error: userError } = await admin
      .from('users')
      .select('id, email, displayName')
      .limit(1)
      .maybeSingle();

    if (userError) {
      steps.push(`   *** DB ERROR: ${JSON.stringify(userError)}`);
      return NextResponse.json({ steps, error: userError });
    }
    steps.push(`   Found user: ${testUser?.displayName || 'none'} (${testUser?.id?.slice(0,8)}...)`);

    steps.push('5. Testing species lookup');
    const { data: species, error: speciesError } = await admin
      .from('species')
      .select('id, commonName, scientificName')
      .eq('scientificName', aiResult.species.scientificName)
      .maybeSingle();

    steps.push(`   Existing species: ${species ? species.commonName : 'NOT FOUND (would be created)'}`);
    if (speciesError) steps.push(`   Error: ${JSON.stringify(speciesError)}`);

    steps.push('6. Testing storage upload');
    const testBuffer = Buffer.from(imageBase64.slice(0, 100), 'base64');
    const testFileName = `__test/${Date.now()}.jpg`;
    const { error: uploadError } = await admin.storage
      .from('submissions')
      .upload(testFileName, testBuffer, { contentType: 'image/jpeg', upsert: false });
    
    if (uploadError) {
      steps.push(`   *** UPLOAD ERROR: ${JSON.stringify(uploadError)}`);
    } else {
      steps.push('   Upload OK');
      // Clean up test file
      await admin.storage.from('submissions').remove([testFileName]);
      steps.push('   Cleaned up test file');
    }

    steps.push('7. All tests passed!');
    return NextResponse.json({
      success: true,
      steps,
      aiResult: {
        species: aiResult.species?.commonName,
        confidence: aiResult.confidence,
      },
    });
  } catch (error: any) {
    steps.push(`*** EXCEPTION: ${error?.message || String(error)}`);
    return NextResponse.json({ success: false, steps, error: error?.message });
  }
}
