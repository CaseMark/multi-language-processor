import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';
const API_KEY = process.env.CASE_API_KEY;

// Supported language codes that map to language names
const LANGUAGE_CODES: Record<string, string> = {
  ja: 'Japanese',
  zh: 'Chinese', 
  ko: 'Korean',
  ar: 'Arabic',
  he: 'Hebrew',
  ru: 'Russian',
  th: 'Thai',
  hi: 'Hindi',
  el: 'Greek',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  en: 'English',
};

// Quick language detection endpoint - returns fast before OCR/translation
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!API_KEY) {
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
    
    // Determine media type
    let mediaType = file.type;
    if (file.type === 'text/plain') {
      // For text files, detect from content directly
      const text = buffer.toString('utf-8').slice(0, 2000);
      const langResult = detectLanguageFromText(text);
      return NextResponse.json({
        language: langResult.language,
        languageName: LANGUAGE_CODES[langResult.language] || 'Unknown',
        confidence: langResult.confidence,
      });
    }

    console.log('Quick language detection with LLM...');
    
    const response = await fetch(`${API_BASE_URL}/llm/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
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

Where language_code is one of: ja (Japanese), zh (Chinese), ko (Korean), ar (Arabic), he (Hebrew), ru (Russian), th (Thai), hi (Hindi), el (Greek), es (Spanish), fr (French), de (German), it (Italian), pt (Portuguese), nl (Dutch), pl (Polish), tr (Turkish), vi (Vietnamese), id (Indonesian), ms (Malay), en (English)

Document content (base64 ${mediaType}): ${base64Data.slice(0, 10000)}...`
          }
        ],
        temperature: 0,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error('LLM language detection failed:', response.status);
      return NextResponse.json({ 
        language: 'unknown', 
        languageName: 'Unknown', 
        confidence: 0 
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('LLM language detection response:', content);
    
    // Parse the JSON response
    try {
      const jsonMatch = content.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const langCode = parsed.language_code?.toLowerCase() || 'en';
        const langName = parsed.language_name || LANGUAGE_CODES[langCode] || 'Unknown';
        const confidence = parsed.confidence || 0.8;
        
        console.log(`Detected language: ${langName} (${langCode}) with confidence ${confidence}`);
        
        return NextResponse.json({
          language: langCode,
          languageName: langName,
          confidence: confidence
        });
      }
    } catch (parseError) {
      console.error('Failed to parse LLM language response:', parseError);
    }
    
    return NextResponse.json({ 
      language: 'en', 
      languageName: 'English', 
      confidence: 0.5 
    });

  } catch (error) {
    console.error('Language detection error:', error);
    return NextResponse.json({ 
      language: 'unknown', 
      languageName: 'Unknown', 
      confidence: 0 
    });
  }
}

// Language detection patterns for common languages (fallback for text files)
const LANGUAGE_PATTERNS: Record<string, RegExp> = {
  ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,
  zh: /[\u4E00-\u9FFF]/,
  ko: /[\uAC00-\uD7AF\u1100-\u11FF]/,
  ar: /[\u0600-\u06FF]/,
  he: /[\u0590-\u05FF]/,
  ru: /[\u0400-\u04FF]/,
  th: /[\u0E00-\u0E7F]/,
  hi: /[\u0900-\u097F]/,
  el: /[\u0370-\u03FF]/,
};

function detectLanguageFromText(text: string): { language: string; confidence: number } {
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 10) {
      return { language: lang, confidence: 0.9 };
    }
  }
  return { language: 'en', confidence: 0.5 };
}
