# Folio

DOM-first pagination. Measure, don't simulate.

```html
<folio page-size="A4">
  <h1>Your content here</h1>
  <p>It just works.</p>
</folio>
```

## Why Folio?

CSS Paged Media sounds great on paper (pun intended). In practice? Browser support is a mess, polyfills are overengineered, and you end up fighting the tool instead of shipping.

Folio takes a different approach:

1. **Let the browser do its job** — render your HTML + CSS normally
2. **Measure the actual DOM** — `offsetHeight` doesn't lie
3. **Apply smart heuristics** — battle-tested rules for where to break
4. **Output pages** — done

No CSS `@page` polyfilling. No abstract syntax tree manipulation. No 47 configuration options for edge cases that don't exist.

## Installation

```bash
npm install foliojs
```

## Usage

### Web Component (Recommended)

```html
<script type="module">
  import 'foliojs';
</script>

<folio page-size="A4">
  <!-- Your content -->
</folio>
```

### JavaScript API

```javascript
import { paginate } from 'foliojs';

const pages = await paginate(document.querySelector('#content'), {
  pageHeight: 1123,
  pageWidth: 794,
});

pages.forEach((page, i) => {
  console.log(`Page ${i + 1}: ${page.blocks.length} blocks`);
});
```

## Options

| Attribute | Default | Description |
|-----------|---------|-------------|
| `page-size` | `A4` | Preset: A4, Letter, Legal |
| `page-height` | `1123` | Height in pixels (overrides page-size) |
| `page-width` | `794` | Width in pixels (overrides page-size) |
| `orientation` | `portrait` | `portrait` or `landscape` |
| `orphan-lines` | `2` | Min lines at bottom of page |
| `widow-lines` | `2` | Min lines at top of page |
| `repeat-table-header` | `false` | Repeat `<thead>` on each page |

## How It Works

Folio categorizes every element into one of seven types:

| Type | Elements | Behavior |
|------|----------|----------|
| **Atomic** | `img`, `hr`, `math`, `svg` | Never split |
| **Prose** | `p` | Orphan/widow rules apply |
| **Line-based** | `pre`, `code` | Split anywhere between lines |
| **Container** | `blockquote`, `div` | Split between children |
| **Semantic pairs** | `figure`+`figcaption`, `dt`+`dd` | Keep together |
| **Semantic sequence** | `li`, `tr` | Keep min 1-2 each side |
| **Heading group** | consecutive `h1`-`h6` | Keep together + min content |

That's it. Seven rules cover 95% of real-world documents.

## What About...

**"What about CSS Paged Media support?"**

Use the actual spec when browsers implement it. Until then, Folio gets the job done.

**"What about complex nested layouts?"**

Folio traverses your DOM tree and finds the deepest level where splitting makes sense. Semantic pairs block their children from splitting. Containers allow it. It works the way you'd expect.

**"What about tables with rowspan/colspan?"**

Rows involved in a rowspan are treated as a single unit. We're not going to break your merged cells.

**"What about oversized images?"**

Landscape images get a landscape page. Portrait images scale or clip. Your call.

## Browser Support

If it runs ES2020 and has a DOM, Folio works.

## Credits

Built for [Cygnus MD](https://github.com/rizkyandriawan/cygnus-md), extracted because others might find it useful.

Heuristics informed by studying [WeasyPrint](https://github.com/Kozea/WeasyPrint) (Python, excellent), [PlutoBook](https://github.com/nicuveo/plutobook) (C++, clean), and Chrome's LayoutNG documentation (C++, comprehensive but dense).

## License

MIT
