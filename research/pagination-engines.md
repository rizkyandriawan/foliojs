# Open-Source Web Rendering Engines with Pagination Support

> Research untuk membangun Folio - DOM-based pagination library

---

## Executive Summary

Penelitian ini membandingkan engine open-source yang menangani pagination/print layout dengan codebase lebih kecil dari Chromium Blink. **Key finding**: kompleksitas pagination bukan dari rendering individual pages, tapi dari reasoning tentang **fragmentation context**, **resume points**, dan **constraint propagation** across fragmentainers.

---

## Evolusi dan Tantangan Web-Based Pagination

### Masalah Fundamental

CSS awalnya didesain untuk **continuous scrolling media** - konten mengalir vertikal tanpa batas yang jelas. Ketika web evolve untuk support printed documents dan PDF, W3C mengembangkan CSS Paged Media Module. Tapi translasi dari continuous-flow ke multi-page fragmentation ternyata **jauh lebih kompleks** dari yang terlihat.

### Dekomposisi Masalah Pagination

1. **Fragmentation Context**
   - Environment di mana konten flow dan break sesuai page boundaries
   - Harus track available space, manage break points, determine optimal split locations

2. **Break Control Properties**
   - `break-before`, `break-after`, `break-inside`
   - Hierarchy di mana conflicting rules harus di-resolve berdasarkan specificity

3. **Orphans & Widows Control**
   - Mencegah isolated lines/blocks di page boundaries
   - Interaksi dengan break control yang non-obvious

### Fakta Menarik

Bahkan browser besar struggle dengan pagination consistency:
- **Google Chrome** invest berbulan-bulan rewriting fragmentation engine mereka
- **LibreOffice Writer** punya pagination bugs yang belum resolved setelah bertahun-tahun development

Ini menunjukkan pagination bukan superficial feature, tapi **fundamental architectural concern**.

---

## WeasyPrint: Python-First Architecture

> **Rekomendasi #1 untuk dipelajari**

### Overview

- **Bahasa**: Python
- **Maintainer**: CourtBouillon (sebelumnya Kozea)
- **Focus**: HTML-to-PDF dengan pagination sebagai first-class citizen
- **Philosophy**: "Designed for pagination, meant to be easy to hack on"

### Arsitektur

```
HTML Input
    ↓
Pango (text rendering) + Cairo (graphics)
    ↓
CSS cascade & specificity calculation
    ↓
Layout computation dengan NG Fragments
    ↓
PDF output via Cairo surfaces
```

**NG Fragments** = data structures yang track di mana layout interrupted dan bagaimana resume di fragmentainer berikutnya.

### Algoritma Page Break

WeasyPrint mengikuti CSS Fragmentation Module Level 3 & 4:

```
1. Layout content ke initial "tall strip"
   - Width = page width
   - Height = determined by content

2. Track potential break points dengan "quality scores":
   - IDEAL: Violate no breaking rules
   - ACCEPTABLE: Violate some non-critical rules
   - LAST_RESORT: Highly undesirable but necessary

3. Jika content > page height:
   - Consult break point scores
   - Select optimal break location

4. Break di semantically appropriate location
```

### Break Decision Tree

```
Content exceeds available space?
│
├─ YES → Can element be broken (break-inside: auto)?
│        │
│        ├─ YES → Find suitable break point
│        │        │
│        │        ├─ Orphans/widows constraints satisfied?
│        │        │  ├─ YES → Break at this point
│        │        │  └─ NO → Look for earlier break
│        │        │
│        │        └─ Return resume position
│        │
│        └─ NO → Move entire element to next page
│
└─ NO → Continue layout normally
```

### Orphans & Widows Implementation

**Problem**: Jika paragraph punya `orphans: 4`, minimal 4 baris harus appear di page yang sama sebelum break.

**Solution**: Re-layout awareness
1. Initial layout pass → determine break point based on available space
2. Second pass → verify break point satisfies orphan/widow constraints
3. Jika tidak → backtrack, find alternative break point
4. Jika tidak ada → accept breaking rule violation (last resort)

### CSS Fragmentation Support

| Property | Support | Notes |
|----------|---------|-------|
| `break-before` | ✅ | For pages |
| `break-after` | ✅ | For pages |
| `break-inside` | ✅ | For pages |
| `box-decoration-break` | ⚠️ | Backgrounds always repeated |
| `margin-break` | ✅ | Full support |
| Named pages | ✅ | Via `page` CSS property |
| Multi-column breaks | ❌ | Not supported |

### Source Files untuk Dipelajari

```
weasyprint/layout/
├── block.py      # Page break logic (lines 304-330, 376-437)
├── page.py       # Page box creation
├── columns.py    # Multi-column breaks
└── inline.py     # Line breaking
```

### API Examples

```python
from weasyprint import HTML

# Basic usage
doc = HTML('document.html').render()
doc.write_pdf('output.pdf')

# Extract specific pages
subset = doc.copy([0, 2, 4])  # Pages 1, 3, 5
subset.write_pdf('subset.pdf')

# Generate bookmarks
bookmarks = doc.make_bookmark_tree()
```

---

## PlutoBook: Purposeful Simplification

> **Rekomendasi #2 - C++ tapi readable**

### Overview

- **Bahasa**: C++
- **Dependencies**: Cairo, Freetype, Harfbuzz, Fontconfig (minimal)
- **Philosophy**: Simplify scope untuk achieve clarity

### Arsitektur

```
HTML/XML Input
    ↓
Hand-written parsers (intentionally simple)
    ↓
CSS application
    ↓
Page-by-page rendering
    ↓
Output: Bitmap canvas / PDF surface
```

### Intentional Limitations

PlutoBook **sengaja tidak support**:

| Feature | Status | Rationale |
|---------|--------|-----------|
| Named pages | ❌ | Reduces state space |
| Variable page sizes | ❌ | Simpler fragmentation |
| Table cell splitting | ❌ | Notorious complexity |

**Benefit**: Fragmentation logic jadi straightforward dan readable.

### Fragmentation Support

```cpp
// Supported break properties
break-before: auto | avoid | page
break-after: auto | avoid | page
break-inside: auto | avoid

// Margin boxes untuk headers/footers
@top-left { content: "Header"; }
@bottom-center { content: counter(page); }
```

### Why Study PlutoBook?

1. **Hand-written parsers** - Clear examples of parsing strategies
2. **No template-heavy C++** - More readable than browser code
3. **Explicit scope** - Developer documented what's NOT supported and why

> "Fragmentation logic is genuinely difficult to implement correctly. The simplified approach prioritizes reliability over feature completeness."

---

## wkhtmltopdf: QtWebKit Wrapper

> **Not recommended** untuk reference pagination algorithm

### Overview

- **Bahasa**: C++ (Qt)
- **Engine**: QtWebKit (deprecated WebKit port)
- **Approach**: Delegates rendering to QtWebKit

### Architecture Problem

QtWebKit designed untuk **screen rendering**, print adalah secondary feature. Pagination features are bolted-on, bukan architected dari awal.

### What It Does Well

```bash
# Page layout options
wkhtmltopdf --page-width 210mm --page-height 297mm \
            --margin-top 20mm --margin-bottom 20mm \
            input.html output.pdf

# Headers/footers via separate HTML
wkhtmltopdf --header-html header.html \
            --footer-html footer.html \
            input.html output.pdf
```

### Limitations

- ❌ CSS margin boxes not supported (uses proprietary header/footer system)
- ❌ Named pages not supported
- ❌ Sophisticated orphan/widow handling limited
- ⚠️ Memory intensive - full QtWebKit loaded per conversion
- ⚠️ Flexbox/Grid rendering inconsistent in print context

### Verdict

Useful sebagai tool, tapi **bukan reference implementation** untuk pagination algorithm.

---

## LibreOffice Writer: Legacy Word Processor

> **Different problem domain** - interactive editing vs batch pagination

### Key Difference

LibreOffice Writer harus support **real-time re-pagination** saat user editing. Ini fundamentally berbeda dari batch pagination.

```
Batch Pagination (WeasyPrint):
  Input → Layout once → Output

Interactive Pagination (LibreOffice):
  Edit → Incremental re-layout → Display
  Edit → Incremental re-layout → Display
  ... (continuous loop)
```

### Known Issues

**Object Anchoring + Page Breaking**:
- Images bisa di-anchor ke paragraphs, pages, atau character positions
- Text wrapping affects surrounding text flow
- Kombinasi ini + page boundaries = edge cases yang complex

**Documented Bug**: Re-pagination jadi "broken" (fails to complete) saat document contains many images with text wrapping.

### Lessons Learned

Pagination untuk **interactive editing** memerlukan:
- Data structures untuk rapid re-layout of specific portions
- Trade-offs antara layout correctness dan responsiveness
- Workarounds yang restrict user flexibility

**For Folio**: Kita fokus ke batch pagination, jadi LibreOffice's challenges mostly tidak relevant.

---

## Vivliostyle.js: Browser-Based Approach

> **Alternative approach** - leverage browser, add pagination on top

### Overview

- **Bahasa**: JavaScript
- **Approach**: Build on browser's layout engine, add CSS Paged Media features
- **Output**: PDF via browser APIs

### Arsitektur

```
HTML + CSS
    ↓
Browser layout engine (Chrome/Firefox)
    ↓
Vivliostyle pagination layer
    ↓
PDF output via browser print API
```

### Recent Feature Additions (2021+)

| Feature | Description |
|---------|-------------|
| Named strings | Text from elements inserted into page headers |
| `:nth()` page selector | Style specific numbered pages |
| Named pages | Elements assigned to named page contexts |
| `:blank` page selector | Style blank pages from spread breaks |

### Limitation

Vivliostyle terbatas oleh browser's existing pagination support:
> "Neither Chrome nor Firefox fully implements CSS Paged Media or CSS Generated Content specifications."

### When to Consider Vivliostyle

- Sudah punya complex CSS yang render well di browser
- Need PDF output dengan some pagination control
- Acceptable bahwa some CSS Paged Media features won't work

---

## Comparative Analysis: Fragmentation Algorithms

### Break Point Scoring (Chrome LayoutNG)

Most sophisticated approach - setiap break location diberi score:

```
PERFECT (score: 0)
  All breaking constraints satisfied

ACCEPTABLE (score: 1-N)
  Some non-critical rules violated
  Score = number of violations

LAST_RESORT (score: MAX)
  Breaking constraints violated
  But content must be laid out somewhere
```

**Algorithm**:
1. Search for highest-scoring break point near fragmentainer boundary
2. Handle conflicting constraints via priority
3. Design ensures "only re-layout at most once per fragmentation flow"

### Orphans/Widows Complexity

**The Re-layout Problem**:

```
Initial layout:
  Page 1: [para lines 1-3]
  Page 2: [para lines 4-10]

But orphans: 4 requires min 4 lines before break!

Re-layout needed:
  Page 1: [para lines 1-4]  ← adjusted
  Page 2: [para lines 5-10]

But what if this adjustment affects other constraints?
  → Potential cascade across multiple pages
```

**Solutions**:
- Chrome LayoutNG: Pre-compute optimal break points, second pass uses them
- WeasyPrint: Re-layout with backtracking, accept violations as last resort

### Block Splitting Across Pages

When block > page height, harus di-split. CSS defines:

| `box-decoration-break` | Behavior |
|------------------------|----------|
| `clone` | Backgrounds/borders repeated on each fragment |
| `slice` | Extended through entire box as if not fragmented |

**Table Splitting** = notoriously difficult:
- Maintain semantic integrity
- Column alignment across pages
- Row spans, column spans, nested cells

Both PlutoBook dan WeasyPrint **don't split table cells** - pragmatic choice.

---

## Recommendations untuk Folio

### Primary Reference: WeasyPrint

**Why**:
- Python = readable
- Pagination-first architecture
- Comprehensive documentation
- Clear separation of concerns

**What to Study**:
```python
# Core pagination logic
weasyprint/layout/block.py    # Break decisions
weasyprint/layout/page.py     # Page creation

# Key concepts
- "resume_at" mechanism
- Break point quality scoring
- Orphan/widow re-layout
```

### Secondary Reference: PlutoBook

**Why**:
- Shows how simplification → clarity
- C++ but readable (no template hell)
- Explicit about what's NOT supported

**What to Learn**:
- Scoping decisions
- Trade-offs documentation
- Simplified fragmentation logic

### Conceptual Reference: Chrome LayoutNG Docs

**Why**:
- State-of-the-art in production
- Well-documented design decisions
- Break point scoring algorithm

**Caveat**: Actual codebase too complex, fokus ke documentation only.

---

## Folio Design Implications

Based on research, untuk Folio:

### 1. Adopt Break Point Scoring

```javascript
const BREAK_SCORE = {
  PERFECT: 0,      // All constraints satisfied
  GOOD: 1,         // Minor violations
  ACCEPTABLE: 2,   // Some violations
  LAST_RESORT: 99  // Overflow prevention only
};
```

### 2. Implement Resume Mechanism

```javascript
// Track where to continue after page break
const resumeAt = {
  blockIndex: 5,
  lineIndex: 3,      // For text blocks
  characterIndex: 0  // For mid-line breaks
};
```

### 3. Intentional Scope Limitations (ala PlutoBook)

**Support**:
- Block-level pagination
- Paragraph splitting with orphan/widow
- Heading keep-with-next
- Simple tables (no cell splitting)

**Explicitly NOT Support** (v1):
- Named pages
- Variable page sizes
- CSS Regions
- Floats at page boundaries

### 4. Measure-First Architecture

```javascript
// WeasyPrint-inspired approach
function paginate(container, options) {
  // Phase 1: Measure everything
  const measurements = measureAllBlocks(container);

  // Phase 2: Find break points with scores
  const breakPoints = findBreakPoints(measurements, options);

  // Phase 3: Paginate using optimal breaks
  return createPages(measurements, breakPoints);
}
```

---

## References

- [WeasyPrint Documentation](https://doc.courtbouillon.org/weasyprint/stable/)
- [WeasyPrint GitHub](https://github.com/Kozea/WeasyPrint)
- [PlutoBook GitHub](https://github.com/nicuveo/plutobook)
- [CSS Fragmentation Module Level 3](https://www.w3.org/TR/css-break-3/)
- [CSS Paged Media Module](https://www.w3.org/TR/css-page-3/)
- [Vivliostyle](https://vivliostyle.org/)
- [Chrome LayoutNG Documentation](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/core/layout/ng/README.md)
