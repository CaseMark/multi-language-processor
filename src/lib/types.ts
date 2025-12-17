// Supported languages for OCR and translation
export const SUPPORTED_LANGUAGES = {
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  zh: { name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  'zh-TW': { name: 'Chinese (Traditional)', nativeName: '繁體中文', flag: '🇹🇼' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  it: { name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  th: { name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  nl: { name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  pl: { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  tr: { name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  he: { name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
  sv: { name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  da: { name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
  fi: { name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
  no: { name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
  cs: { name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
  el: { name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  hu: { name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺' },
  ro: { name: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
  uk: { name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  ms: { name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// Document processing status
export type ProcessingStatus = 
  | 'idle'
  | 'uploading'
  | 'detecting_language'
  | 'ocr_processing'
  | 'cleaning_text'
  | 'translating'
  | 'indexing'
  | 'completed'
  | 'error';

// Document model
export interface Document {
  id: string;
  filename: string;
  originalLanguage: LanguageCode;
  originalText: string;
  translatedText: string;
  pageCount: number;
  uploadedAt: string;
  processedAt?: string;
  status: ProcessingStatus;
  error?: string;
  vaultObjectId?: string;
  translatedVaultObjectId?: string;
  confidence?: number;
}

// Search result
export interface SearchResult {
  documentId: string;
  filename: string;
  originalLanguage: LanguageCode;
  chunks: SearchChunk[];
}

export interface SearchChunk {
  text: string;
  translatedText?: string;
  pageNumber?: number;
  score: number;
  isOriginal: boolean; // true if match was in original language
}

// Vault search response
export interface VaultSearchResponse {
  method: string;
  query: string;
  chunks: {
    text: string;
    object_id: string;
    chunk_index: number;
    hybridScore: number;
    vectorScore: number;
    bm25Score: number;
  }[];
  sources: {
    id: string;
    filename: string;
    pageCount: number;
  }[];
}

// OCR response
export interface OCRResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  text?: string;
  confidence?: number;
  page_count?: number;
  links?: {
    text: string;
    json: string;
    pdf: string;
  };
}

// Translation request/response
export interface TranslationRequest {
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: 'en';
  preserveFormatting: boolean;
}

export interface TranslationResponse {
  translatedText: string;
  detectedLanguage?: LanguageCode;
  confidence: number;
}

// Certified translation export
export interface CertifiedTranslation {
  documentId: string;
  originalFilename: string;
  originalLanguage: LanguageCode;
  translationDate: string;
  certificationStatement: string;
  originalText: string;
  translatedText: string;
  pageCount: number;
}

// API error
export interface APIError {
  message: string;
  code: string;
  details?: Record<string, unknown>;
}
