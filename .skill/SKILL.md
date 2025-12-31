---
name: multi-language-processor
description: |
  Development skill for CaseMark's Multi-Language Document Processor - a tool for 
  OCR, translation, and bilingual search of Latin-script language documents for 
  international litigation. Features side-by-side viewing, language detection, and 
  certified translation export. Built with Next.js 14 and Case.dev APIs (OCR, LLM, 
  Vaults). Use this skill when: (1) Working on the multi-language-processor codebase, 
  (2) Implementing OCR or translation features, (3) Building bilingual search, 
  (4) Adding language support, or (5) Creating certified export functionality.
---

# Multi-Language Document Processor Development Guide

A document processing tool for international litigation—OCR documents in Latin-script languages, translate to English, and search in both languages with side-by-side viewing.

**Live site**: https://multi-language-processor.casedev.app

## Architecture

```
src/
├── app/
│   ├── globals.css              # Global styles + split-pane CSS
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Main application page
├── components/
│   ├── DocumentUpload.tsx       # File upload with progress
│   ├── SplitPaneViewer.tsx      # Side-by-side document view
│   ├── BilingualSearch.tsx      # Search across languages
│   └── CertifiedExport.tsx      # Export with certification
└── lib/
    ├── types.ts                 # Types & language config
    └── case-api.ts              # Case.dev API client
```

## Core Workflow

```
Upload Doc → OCR Extract → Detect Language → Translate → Index → Search/View
     ↓           ↓              ↓               ↓          ↓         ↓
  PDF/image   Case.dev      AI identifies    LLM to      Vault    Bilingual
  Latin text    OCR         Spanish, etc.    English     index    results
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | Next.js API Routes |
| OCR | Case.dev OCR (multilingual) |
| Translation | Case.dev LLM |
| Search | Case.dev Vaults (bilingual index) |

## Key Features

| Feature | Description |
|---------|-------------|
| Multilingual OCR | Extract text from Latin-script documents |
| Language Detection | AI-powered identification with confidence |
| Translation | Professional-grade legal translation |
| Bilingual Search | Query in English or original language |
| Side-by-Side View | Split-pane with synchronized scrolling |
| Certified Export | Court-ready PDF/DOCX with certification |

## Supported Languages

| Region | Languages |
|--------|-----------|
| Western Europe | Spanish, French, German, Italian, Portuguese, Dutch |
| Central Europe | Polish, Czech, Hungarian, Romanian, Slovak, Croatian |
| Nordic | Swedish, Danish, Finnish, Norwegian, Icelandic |
| Other | Turkish, Indonesian, Malay, Vietnamese, Tagalog |

**Note**: Currently supports Latin alphabet only. Non-Latin scripts (Chinese, Arabic, Russian, etc.) not yet supported.

## Case.dev Integration

See [references/casedev-translation-api.md](references/casedev-translation-api.md) for API patterns.

### OCR Service
```typescript
const ocrResult = await ocrService.process(documentUrl, 'gpt-4o');
```

### Translation Service
```typescript
const { language } = await translationService.detectLanguage(text);
const { translatedText } = await translationService.translateToEnglish(text, language);
```

### Vault Service (Bilingual Index)
```typescript
await vaultService.uploadFile(uploadUrl, file, contentType);
await vaultService.ingestDocument(vaultId, objectId);
const results = await vaultService.search(vaultId, query, { method: 'hybrid' });
```

## Development

### Setup
```bash
npm install
cp .env.example .env.local
# Add CASE_API_KEY to .env.local
npm run dev
```

### Environment
```
CASE_API_KEY=sk_case_...    # Case.dev API key
```

## Common Tasks

### Adding a New Language
1. Add to language config in `lib/types.ts`
2. Update language detection prompt
3. Add flag/native name mapping
4. Test OCR accuracy for that language

### Improving Translation Quality
See [references/translation-quality.md](references/translation-quality.md) for legal translation prompts.

### Adding Export Format
1. Create export template
2. Add certification statement
3. Generate PDF/DOCX with formatting

## Troubleshooting

| Issue | Solution |
|-------|----------|
| OCR fails | Check if language uses Latin script |
| Wrong language detected | Increase text sample size |
| Translation misses legal terms | Add to terminology glossary |
| Search returns wrong language | Check index includes both versions |
