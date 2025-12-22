import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this route requires runtime environment variables
export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const { vaultId } = await params;
  
  // Check API key at runtime, not build time
  const apiKey = process.env.CASE_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key not configured. Please set CASE_API_KEY in your environment variables.' }, 
      { status: 500 }
    );
  }

  try {
    // Get all objects in the vault
    const response = await fetch(`${API_BASE_URL}/vault/${vaultId}/objects`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: response.status });
    }

    const objects = await response.json();
    
    // Filter to only include completed/indexed documents
    const documents = (objects.objects || objects || []).filter((obj: { ingestionStatus?: string }) => 
      obj.ingestionStatus === 'completed'
    );

    return NextResponse.json({ documents });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
