import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';
const API_KEY = process.env.CASE_API_KEY;

// Supported Latin alphabet language codes
const LANGUAGE_NAMES: Record<string, string> = {
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
const SUPPORTED_LANG_CODES = Object.entries(LANGUAGE_NAMES)
  .map(([code, name]) => `${code} (${name})`)
  .join(', ');

// Detect language using LLM
async function detectLanguageWithLLM(text: string): Promise<{ language: string; languageName: string; confidence: number }> {
  if (!API_KEY || text.length < 50) {
    return { language: 'en', languageName: 'English', confidence: 0.5 };
  }

  try {
    const sampleText = text.slice(0, 3000);
    
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
            content: `Identify the PRIMARY language of this text.

Respond with ONLY a JSON object in this exact format (no other text):
{"language_code": "XX", "language_name": "Language Name", "confidence": 0.95}

Where language_code is one of: ${SUPPORTED_LANG_CODES}

Text to analyze:
${sampleText}`
          }
        ],
        temperature: 0,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      return { language: 'en', languageName: 'English', confidence: 0.5 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    try {
      const jsonMatch = content.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const langCode = parsed.language_code?.toLowerCase() || 'en';
        const langName = parsed.language_name || LANGUAGE_NAMES[langCode] || 'Unknown';
        const confidence = parsed.confidence || 0.8;
        
        return {
          language: langCode,
          languageName: langName,
          confidence: confidence
        };
      }
    } catch {
      // Parse error - fall through to default
    }
    
    return { language: 'en', languageName: 'English', confidence: 0.5 };
  } catch {
    return { language: 'en', languageName: 'English', confidence: 0.5 };
  }
}

async function translateText(text: string, sourceLanguage: string): Promise<string> {
  if (!API_KEY || sourceLanguage === 'en') {
    return text;
  }

  const langName = LANGUAGE_NAMES[sourceLanguage] || sourceLanguage;

  try {
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
            role: 'system',
            content: `You are a professional legal translator specializing in ${langName} to English translation.
Translate the following document accurately while:
1. Preserving all formatting (paragraphs, line breaks, bullet points, numbering)
2. Maintaining legal terminology precision
3. Keeping proper nouns and names in their original form with English transliteration in parentheses where helpful
4. Preserving any dates, numbers, and reference codes exactly as they appear
5. Translating headers and section titles appropriately

Provide ONLY the translation, no explanations or notes.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      return text;
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch {
    return text;
  }
}

// Clean up OCR text formatting using LLM
async function cleanupOCRText(text: string, sourceLanguage: string): Promise<string> {
  if (!API_KEY || text.length < 50 || sourceLanguage === 'en') {
    return text;
  }

  const langName = LANGUAGE_NAMES[sourceLanguage] || sourceLanguage;

  try {
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
            role: 'system',
            content: `You are a text formatting specialist. The following text was extracted via OCR and may have formatting issues like:
- Broken lines in the middle of sentences
- Missing spaces between words
- Inconsistent paragraph breaks
- Random line breaks that don't belong

Clean up the formatting while:
1. Keeping the text in its ORIGINAL ${langName} language (DO NOT translate)
2. Fixing broken sentences by joining lines that were incorrectly split
3. Adding proper paragraph breaks where they logically belong
4. Fixing obvious spacing issues
5. Preserving intentional formatting like bullet points, numbered lists, headers

Output ONLY the cleaned up ${langName} text, nothing else.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      return text;
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch {
    return text;
  }
}

// Save translation to vault object metadata
async function saveTranslationToVault(
  vaultId: string, 
  objectId: string, 
  data: { 
    originalText: string;
    translatedText: string; 
    detectedLanguage: string; 
    detectedLanguageName: string;
  }
): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/vault/${vaultId}/objects/${objectId}/metadata`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mlp_original_text: data.originalText,
        mlp_translation: data.translatedText,
        mlp_detected_language: data.detectedLanguage,
        mlp_detected_language_name: data.detectedLanguageName,
        mlp_translated_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Best-effort cache - don't throw
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vaultId: string; objectId: string }> }
) {
  const { vaultId, objectId } = await params;
  
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    // Get object metadata
    const metaResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/objects/${objectId}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    if (!metaResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch document' }, { status: metaResponse.status });
    }

    const metadata = await metaResponse.json();

    // Check if we have cached data in metadata
    const cachedOriginalText = metadata.mlp_original_text;
    const cachedTranslation = metadata.mlp_translation;
    const cachedLanguage = metadata.mlp_detected_language;
    const cachedLanguageName = metadata.mlp_detected_language_name;

    // If we have all cached data, use it
    if (cachedOriginalText && cachedTranslation && cachedLanguage) {
      return NextResponse.json({
        id: objectId,
        filename: metadata.filename || metadata.name || 'Unknown',
        originalText: cachedOriginalText,
        translatedText: cachedTranslation,
        detectedLanguage: cachedLanguage,
        detectedLanguageName: cachedLanguageName || LANGUAGE_NAMES[cachedLanguage] || 'Unknown',
        pageCount: metadata.pageCount || 1,
        createdAt: metadata.createdAt,
        cached: true,
      });
    }

    // Get extracted text from vault
    const textResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/objects/${objectId}/text`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    if (!textResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch document text' }, { status: textResponse.status });
    }

    const textData = await textResponse.json();
    const rawText = textData.text || '';

    // Use cached language if available, otherwise detect with LLM
    let language: string;
    let languageName: string;
    
    if (cachedLanguage) {
      language = cachedLanguage;
      languageName = cachedLanguageName || LANGUAGE_NAMES[cachedLanguage] || 'Unknown';
    } else {
      const detected = await detectLanguageWithLLM(rawText);
      language = detected.language;
      languageName = detected.languageName;
    }

    // Clean up the OCR text if not English
    let cleanedOriginalText = rawText;
    if (language !== 'en') {
      cleanedOriginalText = await cleanupOCRText(rawText, language);
    }

    // Translate if not English
    let translatedText = cleanedOriginalText;
    if (language !== 'en') {
      translatedText = await translateText(cleanedOriginalText, language);
      
      // Save both cleaned original and translation to vault for future use
      await saveTranslationToVault(vaultId, objectId, {
        originalText: cleanedOriginalText,
        translatedText,
        detectedLanguage: language,
        detectedLanguageName: languageName,
      });
    }

    return NextResponse.json({
      id: objectId,
      filename: metadata.filename || metadata.name || 'Unknown',
      originalText: cleanedOriginalText,
      translatedText,
      detectedLanguage: language,
      detectedLanguageName: languageName,
      pageCount: metadata.pageCount || 1,
      createdAt: metadata.createdAt,
      cached: false,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}
