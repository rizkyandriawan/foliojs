# Folio

**DOM-first pagination. Measure, don't simulate.**

Folio is a JavaScript library that paginates HTML content into discrete pages, perfect for print layouts and PDF generation. Unlike CSS Paged Media polyfills that try to simulate browser behavior, Folio measures the actual rendered DOM and applies smart heuristics for optimal page breaks.

```html
<folio-pages page-size="A4">
  <h1>Your Document Title</h1>
  <p>Your content here. Folio handles the rest.</p>
</folio-pages>
```

## Why Folio?

CSS Paged Media sounds great on paper (pun intended). In practice? Browser support is inconsistent, polyfills are overengineered, and you end up fighting the tool instead of shipping.

Folio takes a different approach:

1. **Let the browser do its job** — render your HTML + CSS normally
2. **Measure the actual DOM** — `offsetHeight` doesn't lie
3. **Apply smart heuristics** — battle-tested rules for where to break
4. **Output pages** — done

No CSS `@page` polyfilling. No abstract syntax tree manipulation. No complex configuration for edge cases.

## Installation

```bash
npm install @rizkyandriawan/foliojs
```

Or use via CDN:

```html
<script type="module">
  import 'https://unpkg.com/@rizkyandriawan/foliojs';
</script>
```

## Quick Start

### Web Component (Recommended)

The easiest way to use Folio is with the `<folio-pages>` web component:

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import '@rizkyandriawan/foliojs';
  </script>
  <style>
    /* Your document styles */
    folio-pages h1 { font-size: 24pt; }
    folio-pages p { line-height: 1.6; }
  </style>
</head>
<body>
  <folio-pages page-size="A4" orientation="portrait">
    <h1>My Document</h1>
    <p>Content goes here...</p>
    <h2>Section Two</h2>
    <p>More content...</p>
  </folio-pages>
</body>
</html>
```

Folio automatically:
- Measures your content with your CSS applied
- Splits content across pages respecting orphan/widow rules
- Keeps headings with their following content
- Handles tables, code blocks, lists, and images intelligently

### JavaScript API

For programmatic control:

```javascript
import { paginate } from '@rizkyandriawan/foliojs';

const result = await paginate(document.querySelector('#content'), {
  pageSize: 'A4',
  orientation: 'portrait',
  padding: 80,
});

console.log(`Generated ${result.totalPages} pages`);
```

## Configuration

### Attributes (Web Component)

| Attribute | Default | Description |
|-----------|---------|-------------|
| `page-size` | `A4` | Page size preset: `A4`, `Letter`, `Legal` |
| `page-width` | `794` | Custom width in pixels (overrides page-size) |
| `page-height` | `1123` | Custom height in pixels (overrides page-size) |
| `orientation` | `portrait` | Page orientation: `portrait` or `landscape` |
| `padding` | `80` | Page padding in pixels (all sides) |
| `orphan-lines` | `2` | Minimum lines to leave at bottom of page |
| `widow-lines` | `2` | Minimum lines to keep at top of new page |
| `min-content-lines` | `3` | Minimum content lines after a heading |
| `repeat-table-header` | `false` | Repeat `<thead>` when tables split across pages |

### JavaScript Options

```javascript
const options = {
  // Page dimensions
  pageSize: 'A4',           // 'A4' | 'Letter' | 'Legal'
  pageWidth: 794,           // pixels
  pageHeight: 1123,         // pixels
  orientation: 'portrait',  // 'portrait' | 'landscape'

  // Padding (number for all sides, or object)
  padding: 80,
  // padding: { top: 80, right: 60, bottom: 40, left: 60 },

  // Typography rules
  orphanLines: 2,           // min lines at page bottom
  widowLines: 2,            // min lines at page top
  minContentLines: 3,       // min content after heading

  // Tables
  repeatTableHeader: false, // repeat <thead> on continuation
  minRowsForSplit: 2,       // min rows to allow table split

  // Lists
  minItemsForSplit: 2,      // min items to allow list split
};
```

## API Reference

### `<folio-pages>` Element

#### Methods

```javascript
const folio = document.querySelector('folio-pages');

// Re-run pagination (e.g., after content or style changes)
folio.paginate();

// Force refresh (re-captures content and paginates)
folio.refresh();

// Generate standalone HTML for PDF conversion
const html = folio.toPrintHTML({
  title: 'My Document',      // <title> for the HTML
  includeStyles: true,       // include all CSS (default: true)
});
```

#### Events

```javascript
folio.addEventListener('paginated', (event) => {
  console.log(`Total pages: ${event.detail.totalPages}`);
  console.log('Pages:', event.detail.pages);
  console.log('Options used:', event.detail.options);
});

folio.addEventListener('error', (event) => {
  console.error('Pagination failed:', event.detail);
});
```

### `paginate()` Function

For direct JavaScript usage without the web component:

```javascript
import { paginate } from '@rizkyandriawan/foliojs';

const result = await paginate(containerElement, options);

// result.pages - Array of Page objects
// result.totalPages - Number of pages
// result.options - Resolved options used
```

## How It Works

### Element Handlers

Folio categorizes every element and applies appropriate splitting logic:

| Type | Elements | Behavior |
|------|----------|----------|
| **Heading** | `h1`-`h6` | Never orphaned; keeps min content after |
| **Prose** | `p` | Splits respecting orphan/widow rules |
| **Code** | `pre`, `code` | Splits between lines with continuation markers |
| **List** | `ul`, `ol` | Splits between items (min 2 items per page) |
| **Table** | `table` | Splits between rows, optionally repeats header |
| **Container** | `blockquote`, `div`, `section` | Splits between children |
| **Atomic** | `img`, `hr`, `svg`, `video`, `canvas` | Never splits |

### Smart Heuristics

**Headings + Content**: A heading won't be left alone at the bottom of a page. Folio ensures at least `minContentLines` (or 1/3 of the next block) follows the heading, or moves everything to the next page.

**Orphans & Widows**: Paragraphs won't leave just 1-2 lines stranded at the bottom (orphan) or top (widow) of a page. Folio adjusts split points to maintain readability.

**Tables**: Tables split between rows, never mid-row. With `repeat-table-header`, the `<thead>` appears on each continuation page.

**Code Blocks**: Code splits between actual lines (not mid-character), with visual indicators showing continuation.

**Images**: Paragraphs containing images are treated as atomic—they move to the next page if they don't fit rather than being clipped.

## PDF Generation

Folio outputs paginated HTML. To convert to PDF, use the `toPrintHTML()` method and pass the result to your preferred PDF generator:

### Browser Print

```javascript
const html = folio.toPrintHTML({ title: 'My Document' });
const win = window.open('', '_blank');
win.document.write(html);
win.document.close();
win.print();
```

### Download HTML

```javascript
const html = folio.toPrintHTML({ title: 'My Document' });
const blob = new Blob([html], { type: 'text/html' });
const url = URL.createObjectURL(blob);

const a = document.createElement('a');
a.href = url;
a.download = 'document.html';
a.click();

URL.revokeObjectURL(url);
```

### Server-Side PDF (Puppeteer)

```javascript
// Server-side with Puppeteer
const puppeteer = require('puppeteer');

async function htmlToPdf(html) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();
  return pdf;
}
```

### WeasyPrint (Python)

```python
from weasyprint import HTML

def html_to_pdf(html_string, output_path):
    HTML(string=html_string).write_pdf(output_path)
```

## CSS Tips

### Styling Paginated Content

Target your styles to the `folio-pages` element:

```css
folio-pages {
  font-family: Georgia, serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #333;
}

folio-pages h1 {
  font-size: 24pt;
  margin-bottom: 0.5em;
}

folio-pages pre {
  background: #f5f5f5;
  padding: 1em;
  overflow-x: auto;
}
```

### Force Page Breaks

Use CSS `break-before` or the `data-folio-break-before` attribute:

```css
.chapter {
  break-before: page;
}
```

```html
<h1 data-folio-break-before>Chapter 2</h1>
```

### Prevent Element Splitting

Use CSS `break-inside` or the `data-folio-keep-together` attribute:

```css
.keep-together {
  break-inside: avoid;
}
```

```html
<figure data-folio-keep-together>
  <img src="chart.png">
  <figcaption>Important chart</figcaption>
</figure>
```

## Page Sizes

| Preset | Width | Height | Common Use |
|--------|-------|--------|------------|
| `A4` | 794px | 1123px | International standard |
| `Letter` | 816px | 1056px | US standard |
| `Legal` | 816px | 1344px | US legal documents |

All sizes assume 96 DPI. For custom sizes, use `page-width` and `page-height` attributes.

## Browser Support

Folio works in any browser that supports:
- ES2020 (async/await, optional chaining)
- Custom Elements v1
- `offsetHeight`, `getComputedStyle`

This includes all modern browsers (Chrome, Firefox, Safari, Edge) and can be used in Node.js with a DOM implementation like JSDOM.

## Framework Integration

### React

```jsx
import '@rizkyandriawan/foliojs';
import { useRef, useEffect } from 'react';

function Document({ content }) {
  const folioRef = useRef(null);

  useEffect(() => {
    const folio = folioRef.current;
    const handlePaginated = (e) => {
      console.log(`Rendered ${e.detail.totalPages} pages`);
    };
    folio.addEventListener('paginated', handlePaginated);
    return () => folio.removeEventListener('paginated', handlePaginated);
  }, []);

  return (
    <folio-pages ref={folioRef} page-size="A4">
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </folio-pages>
  );
}
```

### Vue

```vue
<template>
  <folio-pages page-size="A4" @paginated="onPaginated">
    <slot />
  </folio-pages>
</template>

<script setup>
import '@rizkyandriawan/foliojs';

const onPaginated = (event) => {
  console.log(`Rendered ${event.detail.totalPages} pages`);
};
</script>
```

## Comparison

| Feature | Folio | Paged.js | CSS Regions |
|---------|-------|----------|-------------|
| Approach | DOM measurement | CSS polyfill | CSS polyfill |
| Setup complexity | Minimal | Moderate | High |
| Custom CSS support | Full | Partial | Partial |
| Table splitting | Yes | Limited | No |
| Code block splitting | Yes | No | No |
| Bundle size | ~15KB | ~100KB | ~80KB |

## Credits

Built for [Cygnus MD](https://github.com/rizkyandriawan/cygnus-md), extracted because others might find it useful.

Heuristics informed by studying:
- [WeasyPrint](https://github.com/Kozea/WeasyPrint) — Python, excellent documentation
- Chrome's LayoutNG — comprehensive fragmentation logic

## License

MIT
