import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';
const API_KEY = process.env.CASE_API_KEY;

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
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    // Add cache-busting to ensure we get fresh data
    const response = await fetch(`${API_BASE_URL}/vault`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch vaults:', errorText);
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
  } catch (error) {
    console.error('Error fetching vaults:', error);
    return NextResponse.json({ error: 'Failed to fetch vaults' }, { status: 500 });
  }
}
