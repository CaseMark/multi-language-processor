import { NextResponse } from 'next/server';

// Force dynamic rendering - this route requires runtime environment variables
export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';

// Check if a vault name matches our app's naming patterns
function isAppVault(vaultName: string): boolean {
  // Current format: "[DOCUMENT NAME] Translation"
  if (vaultName.endsWith(' Translation')) return true;
  
  // Legacy format: "12-17-2025 22:45 Documents for translation"
  if (vaultName.endsWith('Documents for translation')) return true;
  
  // Legacy format: "multi-lang-processor-1234567890"
  if (vaultName.startsWith('multi-lang-processor-')) return true;
  
  return false;
}

export async function GET() {
  // Check API key at runtime, not build time
  const apiKey = process.env.CASE_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key not configured. Please set CASE_API_KEY in your environment variables.' }, 
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${API_BASE_URL}/vault`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch vaults' }, { status: response.status });
    }

    const allVaults = await response.json();
    const vaultsList = Array.isArray(allVaults) ? allVaults : allVaults.vaults || [];
    
    // Filter to only show vaults created by this app
    const filteredVaults = vaultsList
      .filter((vault: { name?: string }) => {
        if (!vault.name) return false;
        return isAppVault(vault.name);
      });
    
    return NextResponse.json(filteredVaults);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch vaults' }, { status: 500 });
  }
}
