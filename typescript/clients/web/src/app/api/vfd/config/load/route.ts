import { NextResponse } from 'next/server';
import { loadConfigBundle, validateBundleAgainstSchemas } from '@/lib/vfd/workspace';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  const configDir = process.env.VFD_CONFIG_DIR ?? 'config/vfd/';

  try {
    const bundle = await loadConfigBundle(configDir);
    const validationErrors = await validateBundleAgainstSchemas(bundle);

    return NextResponse.json({
      success: true,
      data: bundle,
      validationErrors: validationErrors.length ? validationErrors : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
