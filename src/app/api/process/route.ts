import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this route requires runtime environment variables
export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';

// Helper to get API key at runtime
function getApiKey(): string | undefined {
  return process.env.CASE_API_KEY;
}

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

// Detect language from document using LLM (primary method)
async function detectLanguageWithLLM(buffer: Buffer, contentType: string, apiKey: string): Promise<{ language: string; languageName: string; confidence: number }> {
  try {
    const base64Data = buffer.toString('base64');
    
    // Determine media type for the content
    let mediaType = contentType;
    if (contentType === 'application/pdf') {
      mediaType = 'application/pdf';
    } else if (contentType.startsWith('image/')) {
      mediaType = contentType;
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

Document content (base64 ${mediaType}): ${base64Data.slice(0, 10000)}...`
          }
        ],
        temperature: 0,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      return { language: 'unknown', languageName: 'Unknown', confidence: 0 };
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
    return { language: 'unknown', languageName: 'Unknown', confidence: 0 };
  }
}

// Clean up OCR text formatting using LLM
async function cleanupOCRText(text: string, sourceLanguage: string, apiKey: string): Promise<string> {
  if (text.length < 50) {
    return text;
  }

  const langName = LANGUAGE_CODES[sourceLanguage] || sourceLanguage;

  try {
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

// Translate text using Case.dev LLM API
async function translateText(text: string, sourceLanguage: string, apiKey: string): Promise<string> {
  const langName = LANGUAGE_CODES[sourceLanguage] || sourceLanguage;

  try {
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
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch {
    return `[Translation failed]\n\nOriginal ${langName} text:\n${text}`;
  }
}

// Get document name without extension for vault naming
function getDocumentBaseName(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const baseName = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  return baseName;
}

// Create or get a vault for document processing
async function getOrCreateVault(filename: string, apiKey: string): Promise<string> {
  const envVaultId = process.env.CASE_VAULT_ID;
  if (envVaultId) {
    return envVaultId;
  }

  const documentName = getDocumentBaseName(filename);
  const vaultName = `${documentName} Translation`;
  
  const response = await fetch(`${API_BASE_URL}/vault`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: vaultName,
      description: `Translation of ${filename}`,
      enableGraph: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create vault: ${response.status} - ${errorText}`);
  }

  const vault = await response.json();
  return vault.id;
}

// Upload file to temporary storage and get a public URL for OCR
async function uploadToVaultAndGetUrl(buffer: Buffer, filename: string, contentType: string, apiKey: string): Promise<{ url: string; objectId: string; vaultId: string }> {
  const vaultId = await getOrCreateVault(filename, apiKey);

  // Get presigned upload URL
  const uploadResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename,
      contentType,
      auto_index: false,
    }),
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to get upload URL: ${uploadResponse.status} - ${errorText}`);
  }

  const uploadData = await uploadResponse.json();

  // Upload file to S3
  const s3Response = await fetch(uploadData.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: new Uint8Array(buffer),
  });

  if (!s3Response.ok) {
    throw new Error(`Failed to upload to S3: ${s3Response.status}`);
  }

  // Get the download URL for the uploaded file
  const objectResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/objects/${uploadData.objectId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!objectResponse.ok) {
    const errorText = await objectResponse.text();
    throw new Error(`Failed to get object metadata: ${objectResponse.status} - ${errorText}`);
  }

  const objectData = await objectResponse.json();

  if (!objectData.downloadUrl) {
    throw new Error('No download URL available for uploaded file');
  }

  return { url: objectData.downloadUrl, objectId: uploadData.objectId, vaultId };
}

// Save processed data to vault object metadata
async function saveProcessedDataToVault(
  vaultId: string, 
  objectId: string, 
  apiKey: string,
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
        'Authorization': `Bearer ${apiKey}`,
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

// Extract text from PDF using vault ingestion
async function extractTextFromPDF(buffer: Buffer, filename: string, apiKey: string): Promise<{ text: string; vaultId: string; objectId: string }> {
  try {
    const vaultId = await getOrCreateVault(filename, apiKey);

    // Get presigned upload URL
    const uploadResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename,
        contentType: 'application/pdf',
        auto_index: true,
      }),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Failed to get upload URL: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadData = await uploadResponse.json();

    // Upload file to S3
    const s3Response = await fetch(uploadData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: new Uint8Array(buffer),
    });

    if (!s3Response.ok) {
      throw new Error(`Failed to upload to S3: ${s3Response.status}`);
    }

    // Trigger ingestion
    await fetch(`${API_BASE_URL}/vault/${vaultId}/ingest/${uploadData.objectId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Poll for ingestion completion
    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/objects/${uploadData.objectId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Failed to check ingestion status: ${statusResponse.status}`);
      }

      const status = await statusResponse.json();

      if (status.ingestionStatus === 'completed') {
        const textResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/objects/${uploadData.objectId}/text`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!textResponse.ok) {
          const errorText = await textResponse.text();
          throw new Error(`Failed to get extracted text: ${textResponse.status} - ${errorText}`);
        }

        const textData = await textResponse.json();
        return { text: textData.text || '', vaultId, objectId: uploadData.objectId };
      }

      if (status.ingestionStatus === 'failed') {
        throw new Error(`Ingestion failed: ${status.error || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Ingestion timed out');
  } catch (error) {
    throw error;
  }
}

// Extract text from image using direct OCR API
async function extractTextFromImage(buffer: Buffer, mimeType: string, filename: string, apiKey: string): Promise<string> {
  try {
    const { url: documentUrl } = await uploadToVaultAndGetUrl(buffer, filename, mimeType, apiKey);

    // Submit OCR job with tesseract engine
    const ocrResponse = await fetch(`${API_BASE_URL}/ocr/v1/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_url: documentUrl,
        engine: 'tesseract',
      }),
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      throw new Error(`OCR API error: ${ocrResponse.status} - ${errorText}`);
    }

    const ocrJob = await ocrResponse.json();

    // Poll for OCR completion
    let attempts = 0;
    const maxAttempts = 90;
    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`${API_BASE_URL}/ocr/v1/${ocrJob.id}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Failed to check OCR status: ${statusResponse.status}`);
      }

      const status = await statusResponse.json();

      if (status.status === 'completed') {
        const textResponse = await fetch(`${API_BASE_URL}/ocr/v1/${ocrJob.id}/download/text`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!textResponse.ok) {
          const errorText = await textResponse.text();
          throw new Error(`Failed to get OCR text: ${textResponse.status} - ${errorText}`);
        }

        return await textResponse.text();
      }

      if (status.status === 'failed') {
        throw new Error(`Image OCR failed: ${status.error || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Image OCR timed out');
  } catch (error) {
    throw error;
  }
}

export async function POST(request: NextRequest) {
  // Check API key at runtime
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key not configured. Please set CASE_API_KEY in your environment variables.' }, 
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      }, { status: 400 });
    }

    // Read file into buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Detect language using LLM
    let detectedLang = { language: 'en', languageName: 'English', confidence: 0.5 };
    
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      detectedLang = await detectLanguageWithLLM(buffer, file.type, apiKey);
    }
    
    // Extract text
    let originalText = '';
    let vaultId = '';
    let objectId = '';
    
    if (file.type === 'text/plain') {
      originalText = buffer.toString('utf-8');
      // For text files, default to English if no clear indicators
      detectedLang = { language: 'en', languageName: 'English', confidence: 0.5 };
    } else if (file.type === 'application/pdf') {
      try {
        const result = await extractTextFromPDF(buffer, file.name, apiKey);
        originalText = result.text;
        vaultId = result.vaultId;
        objectId = result.objectId;
      } catch {
        return NextResponse.json({ 
          error: 'PDF text extraction failed. Please try again.' 
        }, { status: 500 });
      }
    } else if (file.type.startsWith('image/')) {
      try {
        originalText = await extractTextFromImage(buffer, file.type, file.name, apiKey);
      } catch {
        return NextResponse.json({ 
          error: 'Image text extraction failed. Please try again.' 
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Clean up OCR text formatting (for non-English documents)
    if (detectedLang.language !== 'en' && originalText.length > 50) {
      originalText = await cleanupOCRText(originalText, detectedLang.language, apiKey);
    }
    
    // Translate to English if not already English
    let translatedText = originalText;
    if (detectedLang.language !== 'en') {
      translatedText = await translateText(originalText, detectedLang.language, apiKey);
    }

    // Save processed data to vault metadata for caching
    if (vaultId && objectId) {
      await saveProcessedDataToVault(vaultId, objectId, apiKey, {
        originalText,
        translatedText,
        detectedLanguage: detectedLang.language,
        detectedLanguageName: detectedLang.languageName,
      });
    }

    return NextResponse.json({
      success: true,
      originalText,
      translatedText,
      detectedLanguage: detectedLang.language,
      detectedLanguageName: detectedLang.languageName,
      confidence: detectedLang.confidence,
      pageCount: 1,
    });

  } catch {
    return NextResponse.json({ 
      error: 'Processing failed. Please try again.' 
    }, { status: 500 });
  }
}
