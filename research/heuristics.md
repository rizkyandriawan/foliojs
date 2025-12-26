# Folio Pagination Heuristics

> Rules untuk setiap component: kapan break before, kapan split

---

## Terminology

- **remaining**: sisa ruang di halaman current (dalam pixels)
- **height**: tinggi element (measured via offsetHeight)
- **minContentLines**: minimum lines content yang harus ikut setelah element
- **orphan**: minimum lines/items yang harus ada di bottom of page saat split
- **widow**: minimum lines/items yang harus ada di top of next page saat split
- **fits**: `height <= remaining`

---

## CSS Override Rules

**CSS properties take precedence over heuristics.**

```javascript
// Check CSS first, before applying any heuristic
const style = getComputedStyle(element);

if (style.breakInside === 'avoid') {
  // Treat as Atomic - cannot split
}

if (style.breakBefore === 'page' || style.breakBefore === 'always') {
  // Force new page before this element
}

if (style.breakAfter === 'page' || style.breakAfter === 'always') {
  // Force new page after this element
}
```

**Custom data attributes:**

```html
<div data-folio-keep-together>...</div>  <!-- Treat as atomic -->
<div data-folio-break-before>...</div>   <!-- Force page break before -->
```

**Priority:**
1. CSS `break-*` properties
2. `data-folio-*` attributes
3. Heuristics (fallback)

---

## Empty Elements

**Rule: Skip empty elements.**

```javascript
function isEmpty(el) {
  return el.textContent.trim() === '' && !hasMediaContent(el);
}

// hasMediaContent checks for img, video, canvas, svg, etc.
```

Empty elements don't occupy pagination space.

---

## Nested Containers

**Rule: Split at the highest level that allows splitting.**

```
1. Traverse top-down
2. If ancestor blocks split → all descendants blocked
3. Find deepest level that CAN split (not blocked by ancestor)
4. Split at that level
```

**Examples:**

```html
<blockquote>              <!-- Container: can split -->
  <div class="note">      <!-- Container: can split -->
    <p>Long paragraph</p> <!-- Prose: can split -->
  </div>
</blockquote>
→ Split at <p> (deepest splittable)
```

```html
<figure>                  <!-- Semantic pair: NO SPLIT -->
  <div class="gallery">   <!-- Blocked by parent -->
    <img /><img />        <!-- Blocked -->
  </div>
  <figcaption>X</figcaption>
</figure>
→ Cannot split, move whole figure to next page
```

```html
<blockquote>              <!-- Container: can split -->
  <figure>                <!-- Semantic pair: NO SPLIT -->
    <img />
    <figcaption>X</figcaption>
  </figure>
  <p>After figure</p>
</blockquote>
→ Split at blockquote level (between figure and p)
```

---

## Headers (h1 - h6)

### Consecutive Headings Rule

Headings yang berurutan tanpa content di antaranya dianggap **satu unit**.

```html
<!-- Ini satu unit -->
<h2>Chapter</h2>
<h3>Section</h3>
<h4>Subsection</h4>
<p>Actual content...</p>
```

| Scenario | Behavior |
|----------|----------|
| H2 → p | Keep H2 + minContent |
| H2 → H3 → p | Keep H2 + H3 + minContent |
| H2 → H3 → H4 → p | Keep ALL + minContent |

**Semua consecutive headings + minContent harus fit, atau semua pindah ke halaman baru.**

### H1

| Aspect | Rule |
|--------|------|
| **Break Before** | ALWAYS - H1 selalu mulai di halaman baru |
| **Split** | NEVER - Jika H1 > page height, ini design problem, bukan pagination problem. Truncate atau reduce font size di CSS. |

### H2 - H6

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `remaining < consecutiveHeadingsHeight + minContent` |
| **Split** | NEVER - Headings seharusnya tidak pernah lebih tinggi dari page. Jika terjadi, treat sebagai `p` dan force split. |

### minContent Calculation

```javascript
minContent = lineHeight * 2  // ~2 baris content setelah heading group
```

Unified untuk semua heading levels. Simple dan predictable.

---

## Paragraph (p)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits && !canSplit` |
| **Split** | IF `lineCount >= 4` (orphan 2 + widow 2) |

### Split Logic

```
totalLines = measureLines(p)

IF totalLines < 4:
  → Don't split, break before instead

linesInRemaining = floor(remaining / lineHeight)

IF linesInRemaining < 2:
  → Don't split (orphan violation), break before

IF (totalLines - linesInRemaining) < 2:
  → Don't split (widow violation), break before

ELSE:
  → Split at linesInRemaining
```

---

## Lists (ul, ol)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits && !canSplit` |
| **Split** | IF `itemCount >= 2` - Split between `li` elements |

### Split Logic

```
items = list.children (li elements)

IF items.length < 2:
  → Don't split, break before

Find split point:
  - Iterate items, accumulate heights
  - Split AFTER item where cumulative height <= remaining
  - Ensure at least 1 item on each side

IF no valid split point (first item alone > remaining):
  → Try splitting the first item itself (if it's a long li)
```

### Nested Lists

```html
<ul>
  <li>Item 1</li>
  <li>
    Item 2
    <ul>
      <li>Nested A</li>
      <li>Nested B</li>
    </ul>
  </li>
</ul>
```

| Aspect | Rule |
|--------|------|
| **Break Before** | Same as regular list |
| **Split** | Prefer split at top-level li boundaries. Jika satu li dengan nested list > remaining, recurse ke nested list. |

---

## List Item (li)

Standalone li (saat parent list mencoba split di dalamnya):

| Aspect | Rule |
|--------|------|
| **Break Before** | N/A (handled by parent) |
| **Split** | IF contains multiple block children OR long text |

### Split Logic

```
IF li contains only inline text:
  → Treat as paragraph, split by lines (orphan 2, widow 2)

IF li contains block elements (p, ul, pre, etc):
  → Split between block children
```

---

## Images (img)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits` |
| **Split** | NEVER under normal circumstances |

### Oversized Image Handling

Cek aspect ratio dulu:

```javascript
const ratio = imageWidth / imageHeight;
const isLandscape = ratio > 1.2;  // threshold untuk "clearly landscape"
```

| Ratio | Strategy |
|-------|----------|
| **Landscape** (ratio > 1.2) | Rotate page ke landscape, scale to fit 1 page |
| **Portrait/Square** | Keep portrait page, scale down atau clip vertically |

### Landscape Image

```
Page orientation: LANDSCAPE
Scale image to fit within landscape page dimensions.
Single page, no clipping needed.
```

### Portrait/Square Oversized Image

```
IF imageHeight > pageHeight (after max scale down):
  Clip vertically dengan CSS:
  - object-fit: cover
  - object-position: top

  page1: show top portion (0 to pageHeight)
  page2: show next portion (pageHeight to 2*pageHeight)
  ... continue until complete
```

### Implementation Note

```javascript
function getImagePageOrientation(img) {
  const ratio = img.naturalWidth / img.naturalHeight;

  if (ratio > 1.2) {
    return 'landscape';
  }
  return 'portrait';  // default
}
```

---

## Figure (figure with figcaption)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits` |
| **Split** | Depends on content |

### Split Logic

```
figure typically contains:
  - img (or other media)
  - figcaption

IF img fits alone but not with caption:
  → DON'T split - keep together, break before

IF img alone > remaining:
  → Break before, then apply oversized image logic

IF figure contains multiple images:
  → Can split between images (keep captions with their images)
```

---

## Tables (table)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits && !canSplit` |
| **Split** | IF `dataRowCount >= 2` - Split between `tr` in `tbody` |

### Split Logic

```
thead = table header (repeat on every page)
tbody rows = data rows

IF dataRowCount < 2:
  → Don't split, break before

Split point:
  - Must keep thead + at least 1 row on first part
  - Must have thead (repeated) + at least 1 row on second part

Available for content = remaining - thead.height
Find row where cumulative height <= available
Split AFTER that row
```

### Repeated Header

```
Page 1:
  [thead]
  [row 1]
  [row 2]

Page 2:
  [thead]  ← repeated
  [row 3]
  [row 4]
```

### Oversized Row (single tr > pageHeight)

| Aspect | Rule |
|--------|------|
| **Split** | NO - Table row splitting breaks semantic integrity |

**Strategy: Rotate page to landscape**

```
IF single row > pageHeight:
  1. New page
  2. Set page orientation = landscape
  3. Render thead + oversized row
  4. Continue with portrait for remaining rows (if any)
```

Wide tables dengan banyak kolom benefit dari landscape orientation - lebih banyak horizontal space, row heights jadi lebih manageable.

### Long Cell Content

Content dalam cell yang melebihi column width di-wrap dengan indicators:

```
| Command                              | Description |
|--------------------------------------|-------------|
| git commit --amend --no-edit --sign ↩| Amend last  |
| ↪ ed-off-by                          |             |
```

| Symbol | Position | Purpose |
|--------|----------|---------|
| `↩` | Akhir baris | Indicates "continues below" |
| `↪` | Awal continuation | Fill margin, indicates "continued from above" |

---

## Code Blocks (pre > code)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits && !canSplit` |
| **Split** | Treat sebagai kumpulan lines, split anywhere |

### Core Concept

Code block = **sequence of lines**, bukan special entity. Setiap line di-treat seperti line di paragraph biasa.

```
┌─────────────────────────┐
│ ▲ padding-top           │  ← hanya di line pertama block
│ const x = 1;            │
│ const y = 2;            │
│ const z = 3;            │
│ ▼ padding-bottom        │  ← hanya di line terakhir block/page
└─────────────────────────┘
```

### Padding Rules

| Position | Padding |
|----------|---------|
| First line of block | `padding-top` |
| Last line of block | `padding-bottom` |
| Last line on page (split) | `padding-bottom` |
| First line on next page (split) | `padding-top` |

```
Page 1:
┌─────────────────────────┐
│ ▲ padding-top           │
│ line 1                  │
│ line 2                  │
│ line 3                  │
│ ▼ padding-bottom        │  ← karena ini akhir page
└─────────────────────────┘

Page 2:
┌─────────────────────────┐
│ ▲ padding-top           │  ← karena ini awal page
│ line 4                  │
│ line 5                  │
│ ▼ padding-bottom        │  ← karena ini akhir block
└─────────────────────────┘
```

### Split Logic

```
Karena setiap line independent:
- No minimum lines requirement
- Split di mana saja antara lines
- Orphan/widow rules TIDAK berlaku (code bukan prose)
```

### Long Line Handling

Lines yang melebihi page width di-wrap dengan visual indicators:

```
// Original (overflow)
const result = someLongFunction(param1, param2, param3, param4, param5);

// Wrapped dengan indicators
const result = someLongFunction(param1, param2, param3, ↩
↪   param4, param5);
```

| Symbol | Position | Purpose |
|--------|----------|---------|
| `↩` | Akhir baris | Indicates "continues below" |
| `↪` | Awal continuation | Fill margin, indicates "continued from above" |

---

## Blockquotes (blockquote)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits && !canSplit` |
| **Split** | Container of blocks, split anywhere between children |

### Core Concept

Blockquote = **container of blocks**, sama seperti code block adalah container of lines.

```
┌─────────────────────────┐
│ ▲ padding-top           │  ← hanya di awal blockquote
│ │ paragraph 1           │
│ │ paragraph 2           │
│ │ paragraph 3           │
│ ▼ padding-bottom        │  ← hanya di akhir blockquote/page
└─────────────────────────┘
```

### Padding Rules

| Position | Padding |
|----------|---------|
| First child of blockquote | `padding-top` |
| Last child of blockquote | `padding-bottom` |
| Last child on page (split) | `padding-bottom` |
| First child on next page (split) | `padding-top` |

### Split Logic

```
- Split anywhere between child blocks
- Border-left continues across pages (visual styling)
- Child blocks follow their own rules (p → orphan/widow, etc)
```

---

## Horizontal Rule (hr)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits` (hr sangat tipis, hampir selalu fits) |
| **Split** | NEVER - It's a line |

### Edge Case

HR di very bottom of page:
- Bisa di-skip (move to next page)
- Atau render, tapi ini waste of space

Recommendation: IF `remaining < hr.height + 20px`, break before.

---

## Math Blocks (div.math, .katex-display)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits` |
| **Split** | NEVER under normal circumstances |

### Oversized Equation

| Aspect | Rule |
|--------|------|
| **Split** | Technically possible tapi breaks mathematical meaning. Options: |

1. Scale down equation (CSS transform)
2. Allow overflow dengan scroll indicator
3. Log warning

Recommendation: Treat sebagai atomic, scale down jika > 80% page height.

---

## Diagrams (div.mermaid, svg)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits` |
| **Split** | NEVER - Diagrams are semantic units |

### Oversized Diagram

Same approach as math blocks:
1. Scale down to fit
2. If still > pageHeight after scaling to minScale (50%), log warning dan render as-is

---

## Admonitions / Callouts (div.note, div.warning, etc)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits && !canSplit` |
| **Split** | Container of blocks, title = first line with padding |

### Core Concept

Admonition = **container dengan title**. Title di-treat seperti "first line" yang punya padding.

```
┌─────────────────────────┐
│ ▲ padding-top           │
│ ⚠ Warning               │  ← title (always keep with first content)
│ paragraph 1             │
│ paragraph 2             │
│ ▼ padding-bottom        │
└─────────────────────────┘
```

### Padding Rules

| Position | Padding |
|----------|---------|
| Title | `padding-top` + keep with first content block |
| Last child of admonition | `padding-bottom` |
| Last child on page (split) | `padding-bottom` |
| First child on next page (split) | `padding-top` + visual indicator |

### Split Logic

```
- Title + first content block = satu unit (like consecutive headings)
- Split anywhere between remaining content blocks
- Background/border continues across pages
- Optional: "continued" indicator on next page
```

---

## Footnotes Section (section.footnotes)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits && !canSplit` |
| **Split** | Between individual footnotes |

### Split Logic

```
Footnotes structure:
  <section class="footnotes">
    <ol>
      <li id="fn1">Footnote 1 text</li>
      <li id="fn2">Footnote 2 text</li>
    </ol>
  </section>

Apply same rules as ordered list.
Keep "Footnotes" header (if any) with at least 1 footnote.
```

---

## Definition Lists (dl > dt + dd)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits && !canSplit` |
| **Split** | Between dt+dd pairs, NEVER between dt and its dd |

### Split Logic

```
<dl>
  <dt>Term 1</dt>
  <dd>Definition 1</dd>
  <dt>Term 2</dt>
  <dd>Definition 2</dd>
</dl>

Group: dt + following dd(s) = satu unit
Split ONLY between units.

IF single unit > remaining:
  → Break before, render on next page

IF single unit > pageHeight:
  → Split within dd (apply paragraph rules)
  → Keep dt dengan start of dd
```

---

## Generic Divs (div tanpa specific class)

| Aspect | Rule |
|--------|------|
| **Break Before** | IF `!fits && !canSplit` |
| **Split** | IF contains multiple block children |

### Split Logic

```
Treat div sebagai transparent wrapper.
Apply rules based on children:
  - IF single child: apply that child's rules
  - IF multiple children: split between children
```

---

## Simplified Mental Model

| Type | Elements | Treatment |
|------|----------|-----------|
| **Line-based** | `pre`, `code` | Split anywhere between lines, padding at edges |
| **Prose** | `p` | Orphan/widow rules apply (min 2 lines each side) |
| **Container** | `blockquote`, `div`, admonitions | Split between children, padding at edges, children follow own rules |
| **Semantic pairs** | `dt`+`dd`, `figure`+`figcaption` | Keep together, never split |
| **Semantic sequence** | `li`, `tr` | Keep min 1-2 each side |
| **Atomic** | `img`, `hr`, `math`, `diagram` | Never split (scale/rotate/clip if oversized) |
| **Heading group** | consecutive `h1`-`h6` | Keep all + minContent together |

### Key Insight

Hampir semua component bisa dikategorikan ke salah satu dari 7 type di atas. Rules per-component hanyalah turunan dari type-nya.

---

## Summary Table

| Element | Break Before | Split |
|---------|--------------|-------|
| h1 | ALWAYS | NEVER |
| h2-h6 | if consecutive headings + 2×lineHeight won't fit | NEVER (force as p if oversized) |
| p | if !fits && !canSplit | if lines >= 4 |
| ul/ol | if !fits && !canSplit | between li, if items >= 2 |
| li | N/A (parent handles) | if has block children or long text |
| img | if !fits | landscape→rotate page; portrait→clip vertically |
| figure | if !fits | keep img+caption together |
| table | if !fits && !canSplit | between rows, repeat thead; oversized row→landscape |
| pre/code | if !fits | split anywhere, no orphan/widow |
| blockquote | if !fits | container: split between children, padding edges |
| hr | if !fits | NEVER |
| math | if !fits | NEVER (scale down if oversized) |
| diagram | if !fits | NEVER (scale down if oversized) |
| admonition | if !fits | container: title+first=unit, split rest, padding edges |
| footnotes | if !fits | sequence: split between items |
| dl | if !fits | semantic pairs: split between dt+dd units |
| div | if !fits | container: split between children, padding edges |

---

## Default Values

```javascript
const DEFAULTS = {
  // Orphan/Widow
  orphanLines: 2,        // min lines at bottom of page
  widowLines: 2,         // min lines at top of next page
  minLinesForSplit: 4,   // orphan + widow

  // Lists & Tables
  minItemsForSplit: 2,   // for lists
  minRowsForSplit: 2,    // for tables (excluding header)

  // Headings
  minContentAfterHeading: 2,  // in lineHeight units (2 × lineHeight)
};
```

---

## Decision Flowchart (Universal)

```
GIVEN: element, remaining space

1. IS HEADING (h2-h6)?
   └─ YES → Collect consecutive headings as unit
            IF unit + 2×lineHeight > remaining → New page
            Add unit, done

2. BREAK BEFORE = 'always'? (h1)
   └─ YES → New page, add element, done

3. FITS?
   └─ YES → Add to page, done

4. CAN SPLIT?
   ├─ Check element type
   ├─ Check minimum requirements (lines, items, rows)
   │
   ├─ YES → Find split point respecting orphan/widow
   │        Split, add first part, new page, add rest
   │
   └─ NO → New page, add whole element

5. OVERSIZED? (element > pageHeight)
   ├─ Scalable (math, diagram) → Scale down, add
   ├─ Image landscape → Rotate page to landscape, fit
   ├─ Image portrait → Clip vertically across pages
   ├─ Table row → Rotate page to landscape
   └─ Splittable (text-based) → Force split ignoring min requirements
```
