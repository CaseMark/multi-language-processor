# Translation Quality Reference

Patterns for professional legal translation and certified export.

## Legal Translation Principles

### Accuracy Over Fluency
Legal translation prioritizes:
1. **Exact meaning** - Every term must be precisely rendered
2. **Terminology consistency** - Same term = same translation throughout
3. **Structure preservation** - Maintain paragraph/section organization
4. **Proper nouns** - Keep names, with transliteration if needed

### Translation Prompt
```typescript
const legalTranslationPrompt = `You are a certified legal translator.

Translate the following ${sourceLanguage} text to English.

REQUIREMENTS:
1. Maintain legal precision - do not paraphrase legal terms
2. Preserve document structure (paragraphs, lists, sections)
3. Keep proper nouns in original form with [English transliteration] if helpful
4. Maintain formal legal register
5. If a term has no direct English equivalent, provide the original term 
   followed by an explanation in brackets
6. Preserve dates, numbers, and currency as-is with conversions noted

LEGAL TERMINOLOGY HANDLING:
- Use standard English legal equivalents where they exist
- For civil law concepts without common law equivalent, explain briefly
- Court names: translate descriptively (e.g., "Tribunal de Grande Instance" → 
  "Court of Major Jurisdiction [French civil court]")

TEXT TO TRANSLATE:
${text}`;
```

## Legal Terminology Glossaries

### Spanish Legal Terms
```typescript
const spanishLegalTerms: Record<string, string> = {
  'demandante': 'plaintiff',
  'demandado': 'defendant',
  'sentencia': 'judgment/ruling',
  'recurso de apelación': 'appeal',
  'escritura pública': 'public deed',
  'poder notarial': 'power of attorney',
  'juzgado': 'court',
  'fiscal': 'prosecutor',
  'abogado': 'attorney/lawyer',
  'procurador': 'legal representative/solicitor',
  'auto': 'court order',
  'providencia': 'procedural order',
};
```

### French Legal Terms
```typescript
const frenchLegalTerms: Record<string, string> = {
  'demandeur': 'plaintiff',
  'défendeur': 'defendant',
  'arrêt': 'judgment/ruling',
  'pourvoi': 'appeal (to supreme court)',
  'acte authentique': 'notarized deed',
  'procuration': 'power of attorney',
  'tribunal': 'court',
  'procureur': 'prosecutor',
  'avocat': 'attorney/lawyer',
  'huissier': 'bailiff/process server',
  'ordonnance': 'order/decree',
  'jugement': 'judgment',
};
```

### German Legal Terms
```typescript
const germanLegalTerms: Record<string, string> = {
  'Kläger': 'plaintiff',
  'Beklagter': 'defendant',
  'Urteil': 'judgment',
  'Berufung': 'appeal',
  'Vollmacht': 'power of attorney',
  'Notar': 'notary',
  'Gericht': 'court',
  'Staatsanwalt': 'prosecutor',
  'Rechtsanwalt': 'attorney/lawyer',
  'Beschluss': 'decision/order',
  'Verfügung': 'order/directive',
};
```

## Certified Translation Export

### Certification Statement
```typescript
const certificationStatement = (
  translatorName: string,
  sourceLanguage: string,
  documentTitle: string,
  pageCount: number,
  date: string
) => `
CERTIFICATE OF TRANSLATION

I, ${translatorName}, hereby certify that:

1. I am competent to translate from ${sourceLanguage} to English.

2. The attached translation of the document titled "${documentTitle}" 
   (${pageCount} pages) is a true and accurate translation of the 
   original ${sourceLanguage} document to the best of my knowledge 
   and ability.

3. This translation was completed on ${date}.

_________________________________
Translator Signature

_________________________________
Printed Name: ${translatorName}

_________________________________
Date: ${date}
`;
```

### Export Formats

#### PDF Export
```typescript
interface CertifiedPDFOptions {
  includeOriginal: boolean;  // Side-by-side or sequential
  includeCertification: boolean;
  headerText?: string;
  footerText?: string;
  watermark?: string;
}

async function exportCertifiedPDF(
  document: BilingualDocument,
  options: CertifiedPDFOptions
): Promise<Blob> {
  const pages = [];
  
  // Add certification page
  if (options.includeCertification) {
    pages.push(renderCertificationPage(document));
  }
  
  // Add document pages
  if (options.includeOriginal) {
    // Side-by-side layout
    for (let i = 0; i < document.pages.length; i++) {
      pages.push(renderSideBySidePage(
        document.pages[i].original,
        document.pages[i].translated
      ));
    }
  } else {
    // Translation only
    for (const page of document.pages) {
      pages.push(renderTranslationPage(page.translated));
    }
  }
  
  return generatePDF(pages, options);
}
```

#### Word Export
```typescript
async function exportCertifiedDocx(
  document: BilingualDocument,
  options: CertifiedDocxOptions
): Promise<Blob> {
  const doc = new Document({
    sections: [
      // Certification section
      {
        children: [
          new Paragraph({
            text: 'CERTIFICATE OF TRANSLATION',
            heading: HeadingLevel.HEADING_1,
          }),
          // ... certification content
        ],
      },
      // Translation section
      {
        children: document.pages.flatMap(page => [
          new Paragraph({ text: page.translated }),
          new Paragraph({ text: '' }),  // Page break indicator
        ]),
      },
    ],
  });
  
  return Packer.toBlob(doc);
}
```

## Quality Assurance

### Automated Checks
```typescript
interface TranslationQAResult {
  issues: TranslationIssue[];
  score: number;  // 0-100
}

interface TranslationIssue {
  type: 'missing_term' | 'inconsistent_term' | 'untranslated' | 'formatting';
  location: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
}

function checkTranslationQuality(
  original: string,
  translation: string
): TranslationQAResult {
  const issues: TranslationIssue[] = [];
  
  // Check for untranslated text (non-proper nouns)
  const untranslated = findUntranslatedText(original, translation);
  issues.push(...untranslated);
  
  // Check terminology consistency
  const inconsistencies = checkTermConsistency(translation);
  issues.push(...inconsistencies);
  
  // Check formatting preservation
  const formatIssues = checkFormatting(original, translation);
  issues.push(...formatIssues);
  
  const score = calculateQAScore(issues);
  
  return { issues, score };
}
```

### Human Review Workflow
```typescript
interface ReviewRequest {
  document_id: string;
  sections_to_review: number[];
  reviewer_notes: string;
  priority: 'standard' | 'urgent';
}

// Flag sections for human review
function flagForReview(
  document: BilingualDocument,
  qaResult: TranslationQAResult
): ReviewRequest {
  const sectionsWithErrors = qaResult.issues
    .filter(i => i.severity === 'error')
    .map(i => parseSectionNumber(i.location));
  
  return {
    document_id: document.id,
    sections_to_review: [...new Set(sectionsWithErrors)],
    reviewer_notes: summarizeIssues(qaResult.issues),
    priority: sectionsWithErrors.length > 5 ? 'urgent' : 'standard',
  };
}
```

## Side-by-Side Viewer

### Synchronized Scrolling
```typescript
// components/SplitPaneViewer.tsx
function SplitPaneViewer({ original, translated }: ViewerProps) {
  const originalRef = useRef<HTMLDivElement>(null);
  const translatedRef = useRef<HTMLDivElement>(null);
  const [syncEnabled, setSyncEnabled] = useState(true);
  
  const handleScroll = (source: 'original' | 'translated') => {
    if (!syncEnabled) return;
    
    const sourceEl = source === 'original' ? originalRef : translatedRef;
    const targetEl = source === 'original' ? translatedRef : originalRef;
    
    if (sourceEl.current && targetEl.current) {
      const scrollRatio = sourceEl.current.scrollTop / 
        (sourceEl.current.scrollHeight - sourceEl.current.clientHeight);
      
      targetEl.current.scrollTop = scrollRatio * 
        (targetEl.current.scrollHeight - targetEl.current.clientHeight);
    }
  };
  
  // ... render split panes
}
```

### Highlight Matching
```typescript
function highlightSearchTerm(
  text: string,
  searchTerm: string,
  language: 'original' | 'translated'
): JSX.Element {
  const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200">{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}
```
