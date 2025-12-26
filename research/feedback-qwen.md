### Feedback on Folio Pagination Heuristics

#### **Edge Cases Missed**
1. **Mixed/nested elements**: 
   - E.g., containers with heading groups or code blocks inside. How do nested rules interact?
   - Tables with `colspan`/`rowspan` (breaks Key Rule 5’s row-splitting logic).
2. **Non-standard elements**:
   - Form inputs, videos (`video`, `canvas`), footnotes, or CSS-generated content (e.g., `::before` pseudoelements).
3. **CSS complexities**:
   - Absolutely positioned/fixed elements, CSS columns/flexbox/grid, or `overflow: hidden` clipping.
4. **Dynamic content**:
   - Elements modified by JavaScript post-render (e.g., expanding accordions).

#### **Overly Complex Rules**
1. **Heading group’s "minContent"**:
   - "2×lineHeight content" is ambiguous (varies by font, scaling). Clarify with fixed line counts (e.g., "min 2 lines").
2. **Code line continuation markers** (Rule 3):
   - Automatic `↩`/`↪` adds parsing overhead. Better as opt-in (e.g., via class).
3. **Admonition handling**:
   - "Title + first content unit" is vague. Define "content unit" (e.g., first paragraph, inline vs. block).

#### **Categorization Gaps**
1. **Missing elements**:
   - Media (`video`, `svg`), form controls (`input`, `select`), footnotes/footers.
2. **Atomic category**:
   - Diagrams may not always be atomic (e.g., long SVG timelines needing rotation/clipping like images).
3. **Semantic sequences**:
   - Missing `ol`/`ul` (only `li` is listed), and nested sequences (e.g., lists inside lists).

#### **Improvement Suggestions**
1. **Explicit priority tiers**:
   - Define rule precedence (e.g., semantic pairs > container splits).
2. **CSS property overrides**:
   - Respect `break-inside`, `page-break-inside`, or custom data attributes (e.g., `data-folio-keep-together`).
3. **Dynamic adjustments**:
   - Allow rotation/scaling to be configurable (e.g., disable image rotation for fixed-page layouts).
4. **Clarity updates**:
   - Replace "minContent" with "min 2 lines" for headings.
   - Clarify "semantic sequence" to apply to `li`, `tr`, `ol`, `ul`.
5. **Edge-case tooling**:
   - Add fallback rendering (e.g., scale-to-fit for unresolved oversized elements).

#### **Critical Concerns**
- **Assumes well-formed HTML**: Fragile if users have malformed structures (e.g., `dt` without `dd`, split `figure`/`figcaption`).
- **No mention of performance**: Splitting large tables/code blocks may cause heavy reflows; suggest throttling or async rendering.
- **Accessibility risks**: Clipped/rotated content might break screen readers (e.g., hidden text in split tables).
