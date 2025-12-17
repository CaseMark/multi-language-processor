import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.CASE_API_URL || 'https://api.case.dev';
const API_KEY = process.env.CASE_API_KEY;

// Helper to create SSE encoder
function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;
  
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const sendEvent = (event: string, data: unknown) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(encoder.encode(message));
  };

  const close = () => {
    controller.close();
  };

  return { stream, sendEvent, close };
}

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

// Language detection patterns for common languages (fallback)
const LANGUAGE_PATTERNS: Record<string, RegExp> = {
  ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,  // Japanese (Hiragana, Katakana, Kanji)
  zh: /[\u4E00-\u9FFF]/,  // Chinese
  ko: /[\uAC00-\uD7AF\u1100-\u11FF]/,  // Korean
  ar: /[\u0600-\u06FF]/,  // Arabic
  he: /[\u0590-\u05FF]/,  // Hebrew
  ru: /[\u0400-\u04FF]/,  // Russian/Cyrillic
  th: /[\u0E00-\u0E7F]/,  // Thai
  hi: /[\u0900-\u097F]/,  // Hindi/Devanagari
  el: /[\u0370-\u03FF]/,  // Greek
};

// Detect language from text using character patterns (fallback method)
function detectLanguageFromText(text: string): { language: string; confidence: number } {
  const sampleText = text.slice(0, 2000);
  
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    const matches = sampleText.match(pattern);
    if (matches && matches.length > 10) {
      return { language: lang, confidence: 0.9 };
    }
  }
  
  // Default to English if no pattern matches
  return { language: 'en', confidence: 0.5 };
}

// Detect language from document using LLM (primary method)
async function detectLanguageWithLLM(buffer: Buffer, contentType: string): Promise<{ language: string; languageName: string; confidence: number }> {
  if (!API_KEY) {
    return { language: 'unknown', languageName: 'Unknown', confidence: 0 };
  }

  try {
    const base64Data = buffer.toString('base64');
    
    // Determine media type for the content
    let mediaType = contentType;
    if (contentType === 'application/pdf') {
      mediaType = 'application/pdf';
    } else if (contentType.startsWith('image/')) {
      mediaType = contentType;
    }

    console.log('Detecting document language with LLM...');
    
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
      return { language: 'unknown', languageName: 'Unknown', confidence: 0 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('LLM language detection response:', content);
    
    // Parse the JSON response
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const langCode = parsed.language_code?.toLowerCase() || 'en';
        const langName = parsed.language_name || LANGUAGE_CODES[langCode] || 'Unknown';
        const confidence = parsed.confidence || 0.8;
        
        console.log(`Detected language: ${langName} (${langCode}) with confidence ${confidence}`);
        
        return {
          language: langCode,
          languageName: langName,
          confidence: confidence
        };
      }
    } catch (parseError) {
      console.error('Failed to parse LLM language response:', parseError);
    }
    
    return { language: 'en', languageName: 'English', confidence: 0.5 };
  } catch (error) {
    console.error('Language detection error:', error);
    return { language: 'unknown', languageName: 'Unknown', confidence: 0 };
  }
}

// Clean up OCR text formatting using LLM
async function cleanupOCRText(text: string, sourceLanguage: string): Promise<string> {
  if (!API_KEY || text.length < 50) {
    return text;
  }

  const languageNames: Record<string, string> = {
    ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ar: 'Arabic',
    he: 'Hebrew', ru: 'Russian', th: 'Thai', hi: 'Hindi',
    el: 'Greek', es: 'Spanish', fr: 'French', de: 'German',
    it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish',
    tr: 'Turkish', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay',
  };

  const langName = languageNames[sourceLanguage] || sourceLanguage;

  try {
    console.log('Cleaning up OCR text formatting...');
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
      console.error('Text cleanup failed:', response.status);
      return text;
    }

    const data = await response.json();
    const cleanedText = data.choices[0].message.content;
    console.log('Text cleanup complete');
    return cleanedText;
  } catch (error) {
    console.error('Text cleanup error:', error);
    return text;
  }
}

// Translate text using Case.dev LLM API
async function translateText(text: string, sourceLanguage: string): Promise<string> {
  if (!API_KEY) {
    // Fallback: return original text with a note
    return `[Translation requires CASE_API_KEY]\n\nOriginal ${sourceLanguage} text:\n${text}`;
  }

  const languageNames: Record<string, string> = {
    ja: 'Japanese', zh: 'Chinese', ko: 'Korean', ar: 'Arabic',
    he: 'Hebrew', ru: 'Russian', th: 'Thai', hi: 'Hindi',
    el: 'Greek', es: 'Spanish', fr: 'French', de: 'German',
    it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish',
    tr: 'Turkish', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay',
  };

  const langName = languageNames[sourceLanguage] || sourceLanguage;

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
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Translation error:', error);
    return `[Translation failed]\n\nOriginal ${langName} text:\n${text}`;
  }
}

// Create or get a vault for document processing
async function getOrCreateVault(): Promise<string> {
  // Check if we have a cached vault ID in environment
  const envVaultId = process.env.CASE_VAULT_ID;
  if (envVaultId) {
    return envVaultId;
  }

  // Create a new vault for processing
  const response = await fetch(`${API_BASE_URL}/vault`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `multi-lang-processor-${Date.now()}`,
      description: 'Temporary vault for document processing',
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
async function uploadToVaultAndGetUrl(buffer: Buffer, filename: string, contentType: string): Promise<{ url: string; objectId: string; vaultId: string }> {
  const vaultId = await getOrCreateVault();
  console.log('Using vault for temp storage:', vaultId);

  // Get presigned upload URL
  const uploadResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename,
      contentType,
      auto_index: false, // Don't auto-index, we'll use direct OCR API
    }),
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to get upload URL: ${uploadResponse.status} - ${errorText}`);
  }

  const uploadData = await uploadResponse.json();
  console.log('Got upload URL, objectId:', uploadData.objectId);

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
  console.log('File uploaded to S3');

  // Get the download URL for the uploaded file (from object metadata, not /download endpoint)
  const objectResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/objects/${uploadData.objectId}`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });

  if (!objectResponse.ok) {
    const errorText = await objectResponse.text();
    throw new Error(`Failed to get object metadata: ${objectResponse.status} - ${errorText}`);
  }

  const objectData = await objectResponse.json();
  console.log('Got download URL for OCR:', objectData.downloadUrl?.slice(0, 50) + '...');

  if (!objectData.downloadUrl) {
    throw new Error('No download URL available for uploaded file');
  }

  return { url: objectData.downloadUrl, objectId: uploadData.objectId, vaultId };
}

// Extract text from PDF using vault ingestion (with doctr OCR)
// Note: For Japanese/CJK text, doctr may not work well - we detect and handle this
async function extractTextFromPDF(buffer: Buffer, filename: string): Promise<string> {
  if (!API_KEY) {
    return '[Text extraction requires CASE_API_KEY - Please add your API key to .env.local]';
  }

  try {
    // Step 1: Get or create a vault
    const vaultId = await getOrCreateVault();
    console.log('Using vault:', vaultId);

    // Step 2: Get presigned upload URL
    const uploadResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
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
    console.log('Got upload URL, objectId:', uploadData.objectId);

    // Step 3: Upload file to S3
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
    console.log('File uploaded to S3');

    // Step 4: Trigger ingestion
    const ingestResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/ingest/${uploadData.objectId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!ingestResponse.ok) {
      const errorText = await ingestResponse.text();
      console.error('Ingest trigger failed:', errorText);
    } else {
      console.log('Ingestion triggered');
    }

    // Step 5: Poll for ingestion completion
    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/objects/${uploadData.objectId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Failed to check ingestion status: ${statusResponse.status}`);
      }

      const status = await statusResponse.json();
      console.log('Ingestion status:', status.ingestionStatus);

      if (status.ingestionStatus === 'completed') {
        // Get extracted text
        const textResponse = await fetch(`${API_BASE_URL}/vault/${vaultId}/objects/${uploadData.objectId}/text`, {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
          },
        });

        if (!textResponse.ok) {
          const errorText = await textResponse.text();
          throw new Error(`Failed to get extracted text: ${textResponse.status} - ${errorText}`);
        }

        const textData = await textResponse.json();
        const extractedText = textData.text || '';
        
        console.log('=== EXTRACTED TEXT DEBUG ===');
        console.log('Text length:', extractedText.length);
        console.log('First 500 chars:', extractedText.slice(0, 500));
        console.log('=== END DEBUG ===');
        
        // Check if OCR produced garbled text (no CJK characters but has garbled patterns)
        // This indicates doctr couldn't handle the language
        const hasCJK = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]/.test(extractedText);
        const hasGarbledPattern = /[A-Z]{2,}[0-9]+|[A-Z][a-z]+[A-Z]/.test(extractedText.slice(0, 200));
        
        if (!hasCJK && hasGarbledPattern && extractedText.length > 100) {
          console.log('OCR produced garbled text (likely non-Latin document)');
          console.log('Note: The doctr OCR engine does not support Japanese/CJK text well.');
          console.log('Returning garbled text - translation will attempt to interpret it.');
          // Return the garbled text - the LLM translation might still be able to help
          // or the user will see the issue and can try a different approach
        }
        
        return extractedText;
      }

      if (status.ingestionStatus === 'failed') {
        throw new Error(`Ingestion failed: ${status.error || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Ingestion timed out');
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
}

// Fallback: Use Claude Vision to extract text from PDF
async function extractTextWithClaudeVision(buffer: Buffer, filename: string): Promise<string> {
  console.log('Using Claude Vision for text extraction...');
  
  // Send PDF as base64 to Claude with document type
  const base64Data = buffer.toString('base64');
  
  try {
    const requestBody = {
      model: 'anthropic/claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: `Please extract ALL text from this document exactly as it appears. 
Preserve the original language (do not translate).
Preserve formatting including line breaks, paragraphs, and structure.
If the document contains Japanese, Chinese, Korean, or other non-Latin text, output it in the original characters.
Output ONLY the extracted text, nothing else.`
            }
          ]
        }
      ],
      temperature: 0,
      max_tokens: 16000,
    };
    
    console.log('Sending request to Claude Vision API...');
    
    const response = await fetch(`${API_BASE_URL}/llm/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Claude Vision response status:', response.status);
    console.log('Claude Vision response:', responseText.slice(0, 500));

    if (!response.ok) {
      console.error('Claude Vision error response:', responseText);
      throw new Error(`Claude Vision failed: ${response.status} - ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Claude response as JSON:', responseText);
      throw new Error('Invalid JSON response from Claude Vision');
    }
    
    // Handle different response formats
    let extractedText = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      extractedText = data.choices[0].message.content || '';
    } else if (data.content && Array.isArray(data.content)) {
      // Anthropic native format
      extractedText = data.content.map((c: { text?: string }) => c.text || '').join('\n');
    } else if (data.error) {
      throw new Error(`Claude API error: ${data.error.message || JSON.stringify(data.error)}`);
    } else {
      console.error('Unexpected response format:', JSON.stringify(data, null, 2));
      throw new Error('Unexpected response format from Claude Vision');
    }
    
    console.log('=== CLAUDE VISION EXTRACTED TEXT ===');
    console.log('Text length:', extractedText.length);
    console.log('First 500 chars:', extractedText.slice(0, 500));
    console.log('=== END CLAUDE VISION DEBUG ===');
    
    return extractedText;
  } catch (error) {
    console.error('Claude Vision extraction error:', error);
    throw error;
  }
}

// Extract text from image using direct OCR API with tesseract engine (better multilingual support)
async function extractTextFromImage(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  if (!API_KEY) {
    return '[Text extraction requires CASE_API_KEY - Please add your API key to .env.local]';
  }

  try {
    // Step 1: Upload to vault and get public URL
    const { url: documentUrl } = await uploadToVaultAndGetUrl(buffer, filename, mimeType);

    // Step 2: Submit OCR job with tesseract engine (better multilingual/CJK support)
    console.log('Submitting image OCR job with tesseract engine...');
    const ocrResponse = await fetch(`${API_BASE_URL}/ocr/v1/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_url: documentUrl,
        engine: 'tesseract', // Tesseract has better multilingual support including Japanese
      }),
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      throw new Error(`OCR API error: ${ocrResponse.status} - ${errorText}`);
    }

    const ocrJob = await ocrResponse.json();
    console.log('Image OCR job created:', ocrJob.id);

    // Step 3: Poll for OCR completion
    let attempts = 0;
    const maxAttempts = 90; // 3 minutes max for OCR
    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`${API_BASE_URL}/ocr/v1/${ocrJob.id}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Failed to check OCR status: ${statusResponse.status}`);
      }

      const status = await statusResponse.json();
      console.log('Image OCR status:', status.status);

      if (status.status === 'completed') {
        // Get the extracted text
        const textResponse = await fetch(`${API_BASE_URL}/ocr/v1/${ocrJob.id}/download/text`, {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
          },
        });

        if (!textResponse.ok) {
          const errorText = await textResponse.text();
          throw new Error(`Failed to get OCR text: ${textResponse.status} - ${errorText}`);
        }

        const extractedText = await textResponse.text();
        console.log('=== IMAGE EXTRACTED TEXT DEBUG ===');
        console.log('Text length:', extractedText.length);
        console.log('First 500 chars:', extractedText.slice(0, 500));
        console.log('=== END DEBUG ===');
        return extractedText;
      }

      if (status.status === 'failed') {
        throw new Error(`Image OCR failed: ${status.error || 'Unknown error'}`);
      }

      // Wait 2 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Image OCR timed out');
  } catch (error) {
    console.error('Image extraction error:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file into buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // STEP 1: Detect language FIRST using LLM (before OCR)
    // This gives us the language immediately from the document visual content
    console.log('=== STEP 1: LANGUAGE DETECTION ===');
    let detectedLang = { language: 'en', languageName: 'English', confidence: 0.5 };
    
    if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      // Use LLM to detect language from the document
      detectedLang = await detectLanguageWithLLM(buffer, file.type);
      console.log(`LLM detected language: ${detectedLang.languageName} (${detectedLang.language}) with confidence ${detectedLang.confidence}`);
    }
    
    // STEP 2: Extract text (OCR for PDFs/images, direct read for text files)
    console.log('=== STEP 2: TEXT EXTRACTION ===');
    let originalText = '';
    
    // Check if it's a text file or needs OCR
    if (file.type === 'text/plain') {
      originalText = buffer.toString('utf-8');
      // For text files, detect language from the text content
      const textLangDetection = detectLanguageFromText(originalText);
      detectedLang = {
        language: textLangDetection.language,
        languageName: LANGUAGE_CODES[textLangDetection.language] || 'Unknown',
        confidence: textLangDetection.confidence
      };
    } else if (file.type === 'application/pdf') {
      // Use vault ingestion for PDF text extraction
      try {
        originalText = await extractTextFromPDF(buffer, file.name);
      } catch (error) {
        // If extraction fails, return error
        console.error('PDF extraction error:', error);
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'PDF text extraction failed. Please ensure CASE_API_KEY is set in .env.local' 
        }, { status: 500 });
      }
    } else if (file.type.startsWith('image/')) {
      // Use vault ingestion with doctr OCR for image text extraction
      try {
        originalText = await extractTextFromImage(buffer, file.type, file.name);
      } catch (error) {
        // If extraction fails, return error
        console.error('Image extraction error:', error);
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Image text extraction failed. Please ensure CASE_API_KEY is set in .env.local' 
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // If LLM detection failed or had low confidence, fall back to text-based detection
    if (detectedLang.confidence < 0.5 && originalText.length > 50) {
      console.log('LLM detection had low confidence, using text-based fallback...');
      const textLangDetection = detectLanguageFromText(originalText);
      if (textLangDetection.confidence > detectedLang.confidence) {
        detectedLang = {
          language: textLangDetection.language,
          languageName: LANGUAGE_CODES[textLangDetection.language] || 'Unknown',
          confidence: textLangDetection.confidence
        };
      }
    }

    console.log('=== LANGUAGE DETECTION RESULT ===');
    console.log('Final detected language:', detectedLang.languageName, `(${detectedLang.language})`);
    console.log('Confidence:', detectedLang.confidence);
    console.log('Original text length:', originalText.length);
    console.log('Original text first 300 chars:', originalText.slice(0, 300));
    console.log('=== END LANGUAGE DEBUG ===');
    
    // STEP 2.5: Clean up OCR text formatting (for non-English documents)
    if (detectedLang.language !== 'en' && originalText.length > 50) {
      console.log('=== STEP 2.5: TEXT CLEANUP ===');
      originalText = await cleanupOCRText(originalText, detectedLang.language);
    }
    
    // STEP 3: Translate to English if not already English
    console.log('=== STEP 3: TRANSLATION ===');
    let translatedText = originalText;
    if (detectedLang.language !== 'en') {
      translatedText = await translateText(originalText, detectedLang.language);
    }

    console.log('=== FINAL RESPONSE DEBUG ===');
    console.log('Returning originalText length:', originalText.length);
    console.log('Returning translatedText length:', translatedText.length);
    console.log('=== END FINAL DEBUG ===');

    return NextResponse.json({
      success: true,
      originalText,
      translatedText,
      detectedLanguage: detectedLang.language,
      detectedLanguageName: detectedLang.languageName,
      confidence: detectedLang.confidence,
      pageCount: 1, // Would be determined by OCR in production
    });

  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Processing failed' 
    }, { status: 500 });
  }
}
