# 🌐 Multi-Language Document Processor

Upload documents in Latin-script languages, OCR them, translate to English, and make them searchable in both languages. Built for international litigation and cross-border legal matters.

Live demo: https://multi-language-processor.casedev.app

![Multi-Language Processor](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)

## ✨ Features

### 🔤 Multilingual OCR (Latin Alphabet Languages)
- European languages (Spanish, French, German, Italian, Portuguese, Dutch, Polish, etc.)
- Nordic languages (Swedish, Danish, Norwegian, Finnish)
- Other Latin-script languages

> **Note:** This tool currently supports languages that use the Latin alphabet. Non-Latin scripts (such as Chinese, Japanese, Korean, Arabic, Hebrew, Russian, etc.) are not yet supported.

### 🔍 Automatic Language Detection
- AI-powered language identification
- Confidence scoring
- Visual language badges with native names

### 📝 Translation to English
- Professional-grade legal translation
- Preserves document formatting
- Maintains proper nouns with transliterations
- Handles legal terminology accurately

### 🔎 Bilingual Search
- Query in English or original language
- Results highlighted in both versions
- Relevance scoring
- Filter by language

### 📄 Side-by-Side View
- Split-pane document viewer
- Synchronized scrolling
- Resizable panels
- Expand/collapse individual panes

### 📜 Certified Translation Export
- Generate certification statements
- Include translator credentials
- Export as PDF or DOCX
- Court-ready formatting

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Case.dev API key ([Get one here](https://console.case.dev))

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd multi-language-processor

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Add your Case.dev API key to .env.local
# CASE_API_KEY=your_api_key_here

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                          │
├─────────────────────────────────────────────────────────────┤
│  DocumentUpload  │  SplitPaneViewer  │  BilingualSearch     │
│  CertifiedExport │  LanguageSelector │  HighlightedText     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Case.dev APIs                             │
├─────────────────────────────────────────────────────────────┤
│  OCR Service     │  LLM Gateway      │  Vault Service       │
│  (Multilingual)  │  (Translation)    │  (Bilingual Index)   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
multi-language-processor/
├── src/
│   ├── app/
│   │   ├── globals.css      # Global styles + split-pane CSS
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Main application page
│   ├── components/
│   │   ├── DocumentUpload.tsx    # File upload with progress
│   │   ├── SplitPaneViewer.tsx   # Side-by-side document view
│   │   ├── BilingualSearch.tsx   # Search across languages
│   │   └── CertifiedExport.tsx   # Export with certification
│   └── lib/
│       ├── types.ts         # TypeScript types & language config
│       └── case-api.ts      # Case.dev API client
├── .env.example             # Environment template
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## 🔧 Case.dev API Integration

### OCR Service
```typescript
// Extract text from documents in any language
const ocrResult = await ocrService.process(documentUrl, 'gpt-4o');
```

### Translation Service
```typescript
// Detect language and translate to English
const { language } = await translationService.detectLanguage(text);
const { translatedText } = await translationService.translateToEnglish(text, language);
```

### Vault Service
```typescript
// Store and search documents bilingually
await vaultService.uploadFile(uploadUrl, file, contentType);
await vaultService.ingestDocument(vaultId, objectId);
const results = await vaultService.search(vaultId, query, { method: 'hybrid' });
```

## 🌍 Supported Languages

| Region | Languages |
|--------|-----------|
| Western Europe | Spanish 🇪🇸, French 🇫🇷, German 🇩🇪, Italian 🇮🇹, Portuguese 🇵🇹, Dutch 🇳🇱 |
| Central Europe | Polish 🇵🇱, Czech 🇨🇿, Hungarian 🇭🇺, Romanian 🇷🇴, Slovak 🇸🇰, Slovenian 🇸🇮, Croatian 🇭🇷 |
| Nordic | Swedish 🇸🇪, Danish 🇩🇰, Finnish 🇫🇮, Norwegian 🇳🇴, Icelandic 🇮🇸 |
| Other | Turkish 🇹🇷, Indonesian 🇮🇩, Malay 🇲🇾, Vietnamese 🇻🇳, Tagalog 🇵🇭 |

> **Coming Soon:** Support for non-Latin scripts including Chinese, Japanese, Korean, Arabic, Hebrew, Russian, Greek, and more.

## 🔮 Future Enhancements

- [ ] Support for non-Latin script languages
- [ ] Batch processing for multiple documents
- [ ] Custom terminology glossaries
- [ ] Human translation review workflow
- [ ] Translation memory integration
- [ ] Quality assurance scoring
- [ ] Document comparison tools
- [ ] API for programmatic access

## 📄 License

APACHE 2.0 License - see LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

---

Built with ❤️ using [Case.dev](https://case.dev) APIs
