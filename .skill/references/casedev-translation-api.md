# Case.dev Translation API Reference

Patterns for OCR, language detection, translation, and bilingual indexing.

## Base Configuration

```typescript
// lib/case-api.ts
const BASE_URL = 'https://api.case.dev/v1';
const API_KEY = process.env.CASE_API_KEY;

async function casedevFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new CaseDevError(await response.json());
  }
  
  return response.json();
}
```

## OCR Service

### Process Document
```typescript
interface OCRRequest {
  document_url: string;
  model?: 'gpt-4o' | 'standard';
  language_hint?: string;  // ISO code
}

interface OCRResponse {
  text: string;
  pages: {
    page_number: number;
    text: string;
    confidence: number;
  }[];
  detected_language?: string;
  word_count: number;
}

async function ocrDocument(documentUrl: string): Promise<OCRResponse> {
  return casedevFetch('/ocr/process', {
    method: 'POST',
    body: JSON.stringify({
      document_url: documentUrl,
      model: 'gpt-4o',  // Best for multilingual
    }),
  });
}
```

### Supported Document Types
- PDF (including scanned)
- Images: JPG, PNG, TIFF, GIF
- Word documents (text extraction)

## Language Detection

### Detect Language
```typescript
interface DetectLanguageResponse {
  language: string;  // ISO 639-1 code
  language_name: string;
  native_name: string;
  confidence: number;  // 0-1
  script: 'latin' | 'cyrillic' | 'arabic' | 'cjk' | 'other';
}

async function detectLanguage(text: string): Promise<DetectLanguageResponse> {
  return casedevFetch('/llm/detect-language', {
    method: 'POST',
    body: JSON.stringify({
      text: text.slice(0, 5000),  // Sample for detection
    }),
  });
}
```

### Language Codes
```typescript
const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  es: { name: 'Spanish', native: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', native: 'Français', flag: '🇫🇷' },
  de: { name: 'German', native: 'Deutsch', flag: '🇩🇪' },
  it: { name: 'Italian', native: 'Italiano', flag: '🇮🇹' },
  pt: { name: 'Portuguese', native: 'Português', flag: '🇵🇹' },
  nl: { name: 'Dutch', native: 'Nederlands', flag: '🇳🇱' },
  pl: { name: 'Polish', native: 'Polski', flag: '🇵🇱' },
  cs: { name: 'Czech', native: 'Čeština', flag: '🇨🇿' },
  sv: { name: 'Swedish', native: 'Svenska', flag: '🇸🇪' },
  da: { name: 'Danish', native: 'Dansk', flag: '🇩🇰' },
  fi: { name: 'Finnish', native: 'Suomi', flag: '🇫🇮' },
  no: { name: 'Norwegian', native: 'Norsk', flag: '🇳🇴' },
  hu: { name: 'Hungarian', native: 'Magyar', flag: '🇭🇺' },
  ro: { name: 'Romanian', native: 'Română', flag: '🇷🇴' },
  tr: { name: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
  vi: { name: 'Vietnamese', native: 'Tiếng Việt', flag: '🇻🇳' },
  id: { name: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩' },
};
```

## Translation Service

### Translate to English
```typescript
interface TranslateRequest {
  text: string;
  source_language: string;  // ISO code
  target_language?: string;  // Default 'en'
  context?: 'legal' | 'medical' | 'technical' | 'general';
  preserve_formatting?: boolean;
}

interface TranslateResponse {
  translated_text: string;
  source_language: string;
  target_language: string;
  word_count: number;
  terminology_notes?: string[];
}

async function translateToEnglish(
  text: string,
  sourceLanguage: string
): Promise<TranslateResponse> {
  return casedevFetch('/llm/translate', {
    method: 'POST',
    body: JSON.stringify({
      text,
      source_language: sourceLanguage,
      target_language: 'en',
      context: 'legal',
      preserve_formatting: true,
    }),
  });
}
```

### Batch Translation
```typescript
async function translateDocument(
  pages: { page_number: number; text: string }[],
  sourceLanguage: string
): Promise<TranslatedPage[]> {
  const results = await Promise.all(
    pages.map(async (page) => {
      const { translated_text } = await translateToEnglish(
        page.text,
        sourceLanguage
      );
      return {
        page_number: page.page_number,
        original_text: page.text,
        translated_text,
      };
    })
  );
  return results;
}
```

## Bilingual Indexing

### Store Both Versions
```typescript
interface BilingualDocument {
  id: string;
  original_text: string;
  original_language: string;
  translated_text: string;
  metadata: {
    filename: string;
    page_count: number;
    upload_date: string;
  };
}

async function indexBilingualDocument(
  vaultId: string,
  doc: BilingualDocument
): Promise<void> {
  // Index original
  await casedevFetch(`/vaults/${vaultId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      content: doc.original_text,
      metadata: {
        ...doc.metadata,
        language: doc.original_language,
        version: 'original',
        document_id: doc.id,
      },
    }),
  });
  
  // Index translation
  await casedevFetch(`/vaults/${vaultId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      content: doc.translated_text,
      metadata: {
        ...doc.metadata,
        language: 'en',
        version: 'translated',
        document_id: doc.id,
      },
    }),
  });
}
```

### Bilingual Search
```typescript
interface BilingualSearchResult {
  document_id: string;
  original_match?: {
    text: string;
    similarity: number;
  };
  translated_match?: {
    text: string;
    similarity: number;
  };
  metadata: Record<string, any>;
}

async function searchBilingual(
  vaultId: string,
  query: string
): Promise<BilingualSearchResult[]> {
  const results = await casedevFetch(`/vaults/${vaultId}/search`, {
    method: 'POST',
    body: JSON.stringify({
      query,
      method: 'hybrid',  // Semantic + keyword
      limit: 20,
    }),
  });
  
  // Group by document_id
  return groupByDocument(results.results);
}
```

## Error Handling

```typescript
class CaseDevError extends Error {
  constructor(public response: { message: string; code?: string }) {
    super(response.message);
  }
}

const ERROR_CODES = {
  UNSUPPORTED_LANGUAGE: 'language_not_supported',
  OCR_FAILED: 'ocr_processing_failed',
  TRANSLATION_FAILED: 'translation_error',
  TEXT_TOO_LONG: 'text_exceeds_limit',
} as const;
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| OCR | 20 | per minute |
| Language detection | 60 | per minute |
| Translation | 30 | per minute |
| Search | 100 | per minute |

## Best Practices

1. **Sample for detection** - Use first 5000 chars for language detection
2. **Batch translations** - Process pages in parallel with rate limiting
3. **Index both versions** - Enable searching in either language
4. **Preserve formatting** - Maintain paragraph structure in translation
5. **Handle mixed languages** - Some documents contain multiple languages
