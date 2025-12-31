# Multi-Language Processor Skill

Agent skill for developing the multi-language-processor application.

## Directory Structure

```
.skill/
├── SKILL.md                           # Core skill (always read first)
└── references/
    ├── casedev-translation-api.md     # OCR, detection, translation APIs
    └── translation-quality.md         # Legal translation & export
```

---

## File Descriptions

### SKILL.md
**Purpose**: Primary entry point for the skill

**Contains**:
- Application architecture overview
- Tech stack (Next.js 14, Case.dev OCR/LLM/Vaults)
- Core workflow (upload → OCR → detect → translate → index → search)
- Supported languages table
- API integration examples
- Development setup

**When loaded**: Queries about multi-language-processor, translation, bilingual search, multilingual OCR

**Size**: ~130 lines

---

### references/casedev-translation-api.md
**Purpose**: Case.dev API integration for translation pipeline

**Contains**:
- Base API configuration
- OCR service for multilingual documents
- Language detection with confidence scores
- Translation to English endpoint
- Bilingual indexing in Vaults
- Bilingual search patterns
- Error handling and rate limits
- Language codes and configuration

**When to read**: Implementing OCR, translation, or search features

**Size**: ~200 lines

---

### references/translation-quality.md
**Purpose**: Legal translation standards and certified export

**Contains**:
- Legal translation principles (accuracy, terminology)
- Translation prompt template
- Legal terminology glossaries (Spanish, French, German)
- Certification statement template
- PDF and Word export patterns
- Quality assurance checks
- Human review workflow
- Side-by-side viewer with synchronized scrolling
- Search term highlighting

**When to read**: Improving translation quality, adding export formats, building viewer

**Size**: ~220 lines

---

## Progressive Disclosure

| Level | What Loads | Token Cost |
|-------|------------|------------|
| 1 | Frontmatter (name + description) | ~60 tokens |
| 2 | SKILL.md body | ~800 tokens |
| 3 | Reference files (as needed) | ~550-600 tokens each |

---

## Installation

```bash
cd multi-language-processor
mkdir -p .skill/references
# Copy files into place
git add .skill/
git commit -m "Add agent skill for multi-language-processor development"
```

---

## Trigger Examples

| Query | Loads |
|-------|-------|
| "Fix the file upload progress bar" | SKILL.md only |
| "Add support for Polish language" | SKILL.md + casedev-translation-api.md |
| "Improve translation of legal terms" | SKILL.md + translation-quality.md |
| "Build certified PDF export" | SKILL.md + translation-quality.md |
| "Fix bilingual search results" | SKILL.md + casedev-translation-api.md |
