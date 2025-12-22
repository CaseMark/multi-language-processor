import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this route requires runtime environment variables
export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';

// Helper to get API key at runtime
function getApiKey(): string | undefined {
  return process.env.CASE_API_KEY;
}

// Supported Latin alphabet language codes
const LANGUAGE_CODES: Record<string, string> = {
  // Western European
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  // Central European
  pl: 'Polish',
  cs: 'Czech',
  hu: 'Hungarian',
  ro: 'Romanian',
  sk: 'Slovak',
  sl: 'Slovenian',
  hr: 'Croatian',
  // Nordic
  sv: 'Swedish',
  da: 'Danish',
  fi: 'Finnish',
  no: 'Norwegian',
  is: 'Icelandic',
  // Other Latin-script
  tr: 'Turkish',
  id: 'Indonesian',
  ms: 'Malay',
  vi: 'Vietnamese',
  tl: 'Tagalog',
  // English
  en: 'English',
};

// Get supported language codes as a string for LLM prompts
const SUPPORTED_LANG_CODES = Object.entries(LANGUAGE_CODES)
  .map(([code, name]) => `${code} (${name})`)
  .join(', ');

// Quick language detection endpoint - returns fast before OCR/translation
export async function POST(request: NextRequest) {
  // Check API key at runtime
  const apiKey = getApiKey();

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ 
        language: 'unknown', 
        languageName: 'Unknown', 
        confidence: 0 
      });
    }

    // Read file into buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');
    
    // For text files, default to English
    if (file.type === 'text/plain') {
      return NextResponse.json({
        language: 'en',
        languageName: 'English',
        confidence: 0.5,
      });
    }

    const response = await fetch(`${API_BASE_URL}/llm/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          {
            role: 'user',
            content: `Look at this document and identify the PRIMARY language used in it.

Respond with ONLY a JSON object in this exact format (no other text):
{"language_code": "XX", "language_name": "Language Name", "confidence": 0.95}

Where language_code is one of: ${SUPPORTED_LANG_CODES}

Document content (base64 ${file.type}): ${base64Data.slice(0, 10000)}...`
          }
        ],
        temperature: 0,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ 
        language: 'unknown', 
        languageName: 'Unknown', 
        confidence: 0 
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse the JSON response
    try {
      const jsonMatch = content.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const langCode = parsed.language_code?.toLowerCase() || 'en';
        const langName = parsed.language_name || LANGUAGE_CODES[langCode] || 'Unknown';
        const confidence = parsed.confidence || 0.8;
        
        return NextResponse.json({
          language: langCode,
          languageName: langName,
          confidence: confidence
        });
      }
    } catch {
      // Parse error - fall through to default
    }
    
    return NextResponse.json({ 
      language: 'en', 
      languageName: 'English', 
      confidence: 0.5 
    });

  } catch {
    return NextResponse.json({ 
      language: 'unknown', 
      languageName: 'Unknown', 
      confidence: 0 
    });
  }
}
