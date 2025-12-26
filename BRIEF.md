# Folio

DOM-first pagination library. Measure, don't simulate.

## Origin Story

This project was born from frustration with **paged.js** while building [Cygnus MD](https://github.com/rizkyandriawan/cygnus-md), a paginated Markdown reader.

### The Problem with Paged.js

Paged.js markets itself as a pagination library, but it's actually a **CSS Paged Media polyfill**. Their approach:

```
HTML + CSS → Simulate CSS fragmentation rules → Hope it becomes pages
```

This is fundamentally flawed because:

1. **CSS fragmentation is broken in browsers** - `break-before`, `break-inside`, `orphans`, `widows` are inconsistently implemented. Paged.js tries to polyfill a spec that browsers themselves can't get right.

2. **They don't measure the DOM** - Instead of measuring actual rendered heights, they try to *calculate* based on CSS rules. This leads to edge cases and quirks.

3. **Over-generalization** - They're so focused on being spec-compliant that they forgot the actual goal: **making pages**.

4. **Irony** - It's called paged.js but it's really css-paged-media-polyfill.js. They lost the plot.

### The Insight

While researching, we looked at how Chromium's Blink engine handles print pagination. Their approach is simple:

1. Render content
2. Measure actual heights
3. Apply heuristics for break points
4. Paginate

No CSS polyfilling. Just measure and break.

### Proof of Concept

We implemented this in Cygnus MD with ~100 lines of code:

```javascript
for (const block of blocks) {
  const height = block.offsetHeight;  // Actually measure!
  const remaining = CONTENT_HEIGHT - currentHeight;
  
  if (height <= remaining) {
    // Fits in current page
    addToPage(block);
  } else if (isSplittable(block) && shouldSplit(block)) {
    // Split across pages (paragraphs, code blocks)
    splitBlock(block, remaining);
  } else {
    // Move to next page
    newPage();
    addToPage(block);
  }
}
```

It works better than paged.js. Why? Because we're solving pagination, not simulating CSS.

---

## Vision for Folio

A proper pagination library that:
- **Measures DOM** - Use actual `offsetHeight`, not CSS calculations
- **Steals from Blink** - Their print heuristics are battle-tested on millions of pages
- **Simple API** - Input container, output pages
- **No CSS magic** - Zero `@page` polyfill nonsense

---

## Package Info

- **npm**: `@rizkyandriawan/foliojs`
- **repo**: `github.com/rizkyandriawan/foliojs`
- **description**: "Paginated view for long HTML. Works. That's it."
- **license**: MIT

---

## API Design

### The Dream: Web Component (Primary API)

```html
<script src="https://unpkg.com/@rizkyandriawan/foliojs"></script>

<folio>
  <h1>My Document</h1>
  <p>Long content here...</p>
  <p>More paragraphs...</p>
</folio>
```

That's it. No JS calls. No config. Just wrap your content in `<folio>`.

With options via attributes:
```html
<folio page-height="1123" page-width="794" padding="80">
  ...content...
</folio>
```

### Programmatic API (Secondary)

```javascript
import { paginate } from '@rizkyandriawan/foliojs';

const pages = paginate(document.querySelector('.content'), {
  pageHeight: 1123,  // A4 at 96 DPI
  pageWidth: 794,
  padding: 80,
});

// Returns array of Page objects
pages.forEach((page, i) => {
  console.log(`Page ${i + 1}: ${page.blocks.length} blocks`);
});
```

### Configuration

```javascript
paginate(container, {
  // Dimensions
  pageHeight: 1123,
  pageWidth: 794,
  padding: 80,
  bottomBuffer: 32,  // Extra space at bottom
  
  // Break rules
  breakBefore: ['h1'],           // Always break before these
  keepWithNext: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],  // Keep with following content
  splittable: ['p', 'pre', 'ul', 'ol'],  // Can be split across pages
  
  // Orphan/widow control
  minLinesForSplit: 8,   // Only split blocks with 8+ lines
  orphanLines: 2,        // Min lines at bottom of page
  widowLines: 2,         // Min lines at top of next page
});
```

### Output Structure

```typescript
interface Page {
  blocks: PageBlock[];
  height: number;
}

interface PageBlock {
  element: HTMLElement;      // The DOM element (cloned)
  isPartial?: boolean;       // True if block was split
  clipTop?: number;          // For partial blocks: offset from top
  clipHeight?: number;       // For partial blocks: visible height
}
```

### Rendering

```javascript
const pages = paginate(container, options);

// Option 1: Get HTML strings
pages.forEach((page, i) => {
  const html = page.blocks.map(b => blockToHTML(b)).join('');
  document.querySelector(`#page-${i}`).innerHTML = html;
});

// Option 2: Use built-in renderer
import { render } from 'folio';

render(pages, document.querySelector('#output'), {
  pageClass: 'folio-page',
  pageStyle: { background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
});
```

---

## Core Algorithm

### Phase 1: Preparation

1. Clone container content to measurement div (hidden, same width)
2. Let browser render/reflow
3. Collect all block-level children

### Phase 2: Measurement

For each block:
- Get `offsetHeight`
- Get computed margin (for spacing)
- Detect line count (for splittable blocks)
- Cache measurements

### Phase 3: Pagination

```
currentPage = new Page()
currentHeight = 0

for each block:
  totalHeight = block.height + block.marginBottom
  remaining = pageHeight - currentHeight
  
  // Rule 1: Forced break
  if shouldBreakBefore(block):
    finalizePage(currentPage)
    currentPage = new Page()
    currentHeight = 0
  
  // Rule 2: Keep with next
  if isKeepWithNext(block) and nextBlock:
    spaceNeeded = totalHeight + minContentHeight
    if spaceNeeded > remaining:
      finalizePage(currentPage)
      currentPage = new Page()
      currentHeight = 0
  
  // Rule 3: Fits in page
  if totalHeight <= remaining:
    currentPage.add(block)
    currentHeight += totalHeight
  
  // Rule 4: Split if possible
  else if canSplit(block):
    { first, second } = splitBlock(block, remaining)
    currentPage.add(first)
    finalizePage(currentPage)
    currentPage = new Page()
    currentPage.add(second)
    currentHeight = second.height
  
  // Rule 5: Move to next page
  else:
    finalizePage(currentPage)
    currentPage = new Page()
    currentPage.add(block)
    currentHeight = totalHeight
```

### Phase 4: Block Splitting

For splittable blocks (P, PRE, LI):

1. Detect line breaks by scanning character positions
2. Calculate how many lines fit in remaining space
3. Apply orphan rule (min 2 lines at bottom)
4. Apply widow rule (min 2 lines at top of next page)
5. Create two partial blocks with clip regions

```javascript
function splitBlock(block, availableHeight) {
  const lines = detectLines(block);
  const avgLineHeight = block.height / lines.count;
  
  let splitAt = Math.floor(availableHeight / avgLineHeight);
  
  // Orphan check
  if (splitAt < ORPHAN_LINES) return null;  // Don't split
  
  // Widow check
  const remaining = lines.count - splitAt;
  if (remaining < WIDOW_LINES) {
    splitAt = lines.count - WIDOW_LINES;
  }
  
  return {
    first: { element: block, clipHeight: splitAt * avgLineHeight },
    second: { element: block, clipTop: splitAt * avgLineHeight }
  };
}
```

---

## Blink Heuristics to Steal

From Chromium source (`third_party/blink/renderer/core/layout/`):

### 1. Unbreakable Elements
- Images (`<img>`)
- Replaced elements (`<video>`, `<iframe>`)
- Form controls
- Elements with `break-inside: avoid`

### 2. Break Avoidance
- Headings prefer to stay with following content
- Table headers repeat on each page
- List items avoid breaking first/last line
- Captions stay with their figure/table

### 3. Break Opportunities
- Between block-level siblings
- Between table rows (but not inside cells)
- Inside long paragraphs (with orphan/widow rules)
- After list markers

### 4. Fragmentation
- Split text nodes at line boundaries
- Preserve inline formatting across breaks
- Handle floats at page boundaries

Source files to study:
- `LayoutBlockFlow::PaginatedContentWasLaidOut()`
- `NGBlockLayoutAlgorithm::BreakBeforeChildIfNeeded()`
- `FragmentainerBreakToken`

---

## Implementation Phases

### Phase 1: MVP
- [ ] Basic pagination (measure, break at blocks)
- [ ] H1 forced break
- [ ] Paragraph splitting with orphan/widow
- [ ] Simple render function

### Phase 2: Better Heuristics
- [ ] Keep-with-next for headings
- [ ] Code block splitting
- [ ] List handling
- [ ] Image handling (avoid breaks inside)

### Phase 3: Advanced
- [ ] Table pagination (row groups, header repeat)
- [ ] Figure/caption grouping
- [ ] Nested block handling
- [ ] Custom break rules via data attributes

### Phase 4: Polish
- [ ] Performance optimization (virtual rendering?)
- [ ] TypeScript types
- [ ] React/Vue/Svelte adapters
- [ ] Documentation site

---

## Non-Goals

- **CSS Paged Media polyfill** - We're not trying to make `@page` work
- **Print stylesheets** - Use browser print or Puppeteer
- **PDF generation** - Out of scope, use Puppeteer/Playwright
- **WYSIWYG editing** - Read-only pagination only

---

## File Structure

```
folio/
├── src/
│   ├── index.ts          # Main exports
│   ├── paginate.ts       # Core pagination algorithm
│   ├── measure.ts        # DOM measurement utilities
│   ├── split.ts          # Block splitting logic
│   ├── heuristics.ts     # Break decision rules
│   ├── render.ts         # Page rendering helpers
│   └── types.ts          # TypeScript interfaces
├── test/
│   ├── fixtures/         # Test HTML files
│   └── *.test.ts
├── examples/
│   ├── basic/
│   ├── markdown/
│   └── document/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## References

- [Cygnus MD pagination implementation](https://github.com/rizkyandriawan/cygnus-md/blob/master/src/components/Reader.tsx)
- [Chromium Blink layout source](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/core/layout/)
- [CSS Fragmentation spec](https://www.w3.org/TR/css-break-3/) (for understanding, not implementing)
- [Paged.js](https://pagedjs.org/) (what NOT to do)
