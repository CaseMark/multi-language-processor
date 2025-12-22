/**
 * Case.dev API Client
 * Handles OCR, LLM translation, and Vault operations for multilingual document processing
 */

import { 
  LanguageCode, 
  SUPPORTED_LANGUAGES, 
  OCRResponse, 
  VaultSearchResponse,
  Document 
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_CASE_API_URL || 'https://api.case.dev';

// Helper to get API key - checks at runtime, not build time
function getApiKey(): string {
  // Check for Vercel environment variable first, then fall back to local .env
  const apiKey = process.env.CASE_API_KEY || process.env.NEXT_PUBLIC_CASE_API_KEY;
  if (!apiKey) {
    throw new Error('CASE_API_KEY environment variable is not set. Please configure CASE_API_KEY in your Vercel project settings or .env.local file.');
  }
  return apiKey;
}

// Check if API key is configured (for use in API routes)
export function isApiKeyConfigured(): boolean {
  return !!(process.env.CASE_API_KEY || process.env.NEXT_PUBLIC_CASE_API_KEY);
}

// Helper for API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `API request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * OCR Service - Extract text from documents in any language
 */
export const ocrService = {
  /**
   * Process a document with OCR
   */
  async process(documentUrl: string, engine: 'doctr' | 'tesseract' | 'paddle' | 'gpt-4o' = 'gpt-4o'): Promise<OCRResponse> {
    return apiRequest<OCRResponse>('/ocr/v1/process', {
      method: 'POST',
      body: JSON.stringify({
        document_url: documentUrl,
        engine,
      }),
    });
  },

  /**
   * Check OCR job status
   */
  async getStatus(jobId: string): Promise<OCRResponse> {
    return apiRequest<OCRResponse>(`/ocr/v1/${jobId}`);
  },

  /**
   * Poll until OCR is complete
   */
  async waitForCompletion(jobId: string, maxAttempts = 60, intervalMs = 2000): Promise<OCRResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getStatus(jobId);
      if (status.status === 'completed') {
        return status;
      }
      if (status.status === 'failed') {
        throw new Error('OCR processing failed');
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error('OCR processing timed out');
  },
};

/**
 * Language Detection and Translation Service using LLMs
 */
export const translationService = {
  /**
   * Detect the language of text
   */
  async detectLanguage(text: string): Promise<{ language: LanguageCode; confidence: number }> {
    const sampleText = text.slice(0, 1000); // Use first 1000 chars for detection
    
    const response = await apiRequest<{
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    }>('/llm/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a language detection expert. Analyze the given text and identify its language.
Respond with ONLY a JSON object in this exact format:
{"language": "ISO_CODE", "confidence": 0.XX}

Use these ISO 639-1 codes: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}
If the language is not in this list, use the closest match.`
          },
          {
            role: 'user',
            content: `Detect the language of this text:\n\n${sampleText}`
          }
        ],
        temperature: 0,
        max_tokens: 100,
      }),
    });

    try {
      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content);
      return {
        language: parsed.language as LanguageCode,
        confidence: parsed.confidence,
      };
    } catch {
      // Default to Spanish if parsing fails (common Latin-alphabet language)
      return { language: 'es', confidence: 0.5 };
    }
  },

  /**
   * Translate text to English while preserving formatting
   */
  async translateToEnglish(
    text: string, 
    sourceLanguage: LanguageCode,
    preserveFormatting = true
  ): Promise<{ translatedText: string; confidence: number }> {
    const languageInfo = SUPPORTED_LANGUAGES[sourceLanguage];
    
    const systemPrompt = preserveFormatting
      ? `You are a professional legal translator specializing in ${languageInfo.name} to English translation.
Translate the following document accurately while:
1. Preserving all formatting (paragraphs, line breaks, bullet points, numbering)
2. Maintaining legal terminology precision
3. Keeping proper nouns and names in their original form with English transliteration in parentheses where helpful
4. Preserving any dates, numbers, and reference codes exactly as they appear
5. Translating headers and section titles appropriately

Provide ONLY the translation, no explanations or notes.`
      : `You are a professional translator. Translate the following ${languageInfo.name} text to English accurately. Provide ONLY the translation.`;

    // Split long texts into chunks for translation
    const maxChunkSize = 8000;
    const chunks = splitTextIntoChunks(text, maxChunkSize);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const response = await apiRequest<{
        choices: Array<{
          message: {
            content: string;
          };
        }>;
      }>('/llm/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-20250514',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: chunk }
          ],
          temperature: 0.3,
          max_tokens: 16000,
        }),
      });

      translatedChunks.push(response.choices[0].message.content);
    }

    return {
      translatedText: translatedChunks.join('\n\n'),
      confidence: 0.95,
    };
  },
};

/**
 * Vault Service - Document storage and bilingual search
 */
export const vaultService = {
  /**
   * Create a new vault for multilingual documents
   */
  async createVault(name: string, description?: string): Promise<{ id: string; name: string }> {
    return apiRequest('/vault', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        enableGraph: true,
      }),
    });
  },

  /**
   * Get upload URL for a document
   */
  async getUploadUrl(
    vaultId: string, 
    filename: string, 
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<{ objectId: string; uploadUrl: string }> {
    return apiRequest(`/vault/${vaultId}/upload`, {
      method: 'POST',
      body: JSON.stringify({
        filename,
        contentType,
        metadata,
        auto_index: false, // We'll handle indexing manually for bilingual support
      }),
    });
  },

  /**
   * Upload file to presigned URL
   */
  async uploadFile(uploadUrl: string, file: File | Blob, contentType: string): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': contentType,
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
  },

  /**
   * Trigger document ingestion
   */
  async ingestDocument(vaultId: string, objectId: string): Promise<{ workflowId: string; status: string }> {
    return apiRequest(`/vault/${vaultId}/ingest/${objectId}`, {
      method: 'POST',
    });
  },

  /**
   * Search vault with bilingual support
   * Searches both original and translated content
   */
  async search(
    vaultId: string, 
    query: string, 
    options: {
      method?: 'hybrid' | 'fast' | 'global' | 'local';
      topK?: number;
      filters?: Record<string, unknown>;
    } = {}
  ): Promise<VaultSearchResponse> {
    return apiRequest(`/vault/${vaultId}/search`, {
      method: 'POST',
      body: JSON.stringify({
        query,
        method: options.method || 'hybrid',
        topK: options.topK || 10,
        filters: options.filters,
      }),
    });
  },

  /**
   * Get object metadata
   */
  async getObject(vaultId: string, objectId: string): Promise<{
    id: string;
    filename: string;
    ingestionStatus: string;
    pageCount?: number;
    textLength?: number;
  }> {
    return apiRequest(`/vault/${vaultId}/objects/${objectId}`);
  },
};

/**
 * Document Processing Pipeline
 * Orchestrates the full workflow: Upload → OCR → Detect Language → Translate → Index
 */
export async function processDocument(
  file: File,
  vaultId: string,
  onProgress?: (status: string, progress: number) => void
): Promise<Document> {
  const documentId = generateId();
  
  try {
    // Step 1: Upload original document
    onProgress?.('Uploading document...', 10);
    const { objectId, uploadUrl } = await vaultService.getUploadUrl(
      vaultId,
      file.name,
      file.type,
      { documentId, type: 'original' }
    );
    await vaultService.uploadFile(uploadUrl, file, file.type);

    // Step 2: Create a temporary URL for OCR (in production, use the vault URL)
    onProgress?.('Processing with OCR...', 25);
    const fileUrl = URL.createObjectURL(file);
    
    // For demo purposes, we'll simulate OCR with the file
    // In production, you'd use the vault's presigned URL
    const ocrJob = await ocrService.process(fileUrl);
    const ocrResult = await ocrService.waitForCompletion(ocrJob.id);
    
    const originalText = ocrResult.text || '';
    
    // Step 3: Detect language
    onProgress?.('Detecting language...', 50);
    const { language, confidence } = await translationService.detectLanguage(originalText);
    
    // Step 4: Translate to English
    onProgress?.('Translating to English...', 65);
    const { translatedText } = await translationService.translateToEnglish(originalText, language);
    
    // Step 5: Index both versions in vault
    onProgress?.('Indexing for search...', 85);
    
    // Index original
    await vaultService.ingestDocument(vaultId, objectId);
    
    // Upload and index translated version
    const translatedBlob = new Blob([translatedText], { type: 'text/plain' });
    const { objectId: translatedObjectId, uploadUrl: translatedUploadUrl } = await vaultService.getUploadUrl(
      vaultId,
      `${file.name.replace(/\.[^/.]+$/, '')}_translated.txt`,
      'text/plain',
      { documentId, type: 'translated', originalLanguage: language }
    );
    await vaultService.uploadFile(translatedUploadUrl, translatedBlob, 'text/plain');
    await vaultService.ingestDocument(vaultId, translatedObjectId);
    
    onProgress?.('Complete!', 100);
    
    return {
      id: documentId,
      filename: file.name,
      originalLanguage: language,
      originalText,
      translatedText,
      pageCount: ocrResult.page_count || 1,
      uploadedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      status: 'completed',
      vaultObjectId: objectId,
      translatedVaultObjectId: translatedObjectId,
      confidence,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      id: documentId,
      filename: file.name,
      originalLanguage: 'en',
      originalText: '',
      translatedText: '',
      pageCount: 0,
      uploadedAt: new Date().toISOString(),
      status: 'error',
      error: errorMessage,
    };
  }
}

/**
 * Bilingual Search
 * Searches both original and translated content, returns unified results
 */
export async function bilingualSearch(
  vaultId: string,
  query: string,
  documents: Document[]
): Promise<Array<{
  document: Document;
  originalMatches: Array<{ text: string; score: number }>;
  translatedMatches: Array<{ text: string; score: number }>;
}>> {
  // Search the vault
  const searchResults = await vaultService.search(vaultId, query, {
    method: 'hybrid',
    topK: 20,
  });

  // Group results by document
  const resultsByDocument = new Map<string, {
    originalMatches: Array<{ text: string; score: number }>;
    translatedMatches: Array<{ text: string; score: number }>;
  }>();

  for (const chunk of searchResults.chunks) {
    const source = searchResults.sources.find(s => s.id === chunk.object_id);
    if (!source) continue;

    // Find the document this belongs to
    const doc = documents.find(
      d => d.vaultObjectId === chunk.object_id || d.translatedVaultObjectId === chunk.object_id
    );
    if (!doc) continue;

    if (!resultsByDocument.has(doc.id)) {
      resultsByDocument.set(doc.id, { originalMatches: [], translatedMatches: [] });
    }

    const docResults = resultsByDocument.get(doc.id)!;
    const match = { text: chunk.text, score: chunk.hybridScore };

    if (chunk.object_id === doc.vaultObjectId) {
      docResults.originalMatches.push(match);
    } else {
      docResults.translatedMatches.push(match);
    }
  }

  // Build final results
  return Array.from(resultsByDocument.entries()).map(([docId, matches]) => ({
    document: documents.find(d => d.id === docId)!,
    ...matches,
  }));
}

// Utility functions
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function splitTextIntoChunks(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
