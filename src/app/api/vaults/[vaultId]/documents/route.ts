import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';
const API_KEY = process.env.CASE_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  const { vaultId } = await params;
  
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    // Get all objects in the vault
    const response = await fetch(`${API_BASE_URL}/vault/${vaultId}/objects`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch vault documents:', errorText);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: response.status });
    }

    const objects = await response.json();
    
    // Filter to only include completed/indexed documents
    const documents = (objects.objects || objects || []).filter((obj: { ingestionStatus?: string }) => 
      obj.ingestionStatus === 'completed'
    );

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching vault documents:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
