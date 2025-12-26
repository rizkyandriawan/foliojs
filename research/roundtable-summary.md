# Roundtable: Folio Pagination Heuristics Review

**Host:** Claude Opus 4.5
**Participants:** Gemini 2.5 Flash, GPT-4o-mini, Grok 4.1 Fast, Qwen 3 235B
**Date:** 2025-12-26

---

## Consensus Points

Semua model **setuju** pada:

1. ✅ **7 types categorization** adalah base yang solid (80-90% coverage)
2. ✅ **Consecutive headings rule** sangat penting untuk struktur dokumen
3. ✅ **Long line wrap dengan `↩`/`↪`** adalah detail yang sering terlewat tapi penting
4. ✅ **Admonition handling** (title + first = unit) adalah keputusan yang tepat
5. ✅ **Code blocks tanpa orphan/widow** makes sense karena bukan prose

---

## Edge Cases yang Terlewat

| Issue | Raised By | Priority |
|-------|-----------|----------|
| **Nested containers** (div dalam div, blockquote dalam li) | All 4 | 🔴 High |
| **Footnotes/references** (`<sup>`, `<aside>`) | Gemini, Grok | 🟡 Medium |
| **Empty elements** (empty `p`, `div`) | Gemini, GPT | 🟡 Medium |
| **Tables dengan colspan/rowspan** | GPT, Qwen | 🟡 Medium |
| **Media elements** (`video`, `iframe`, `canvas`) | Grok, Qwen | 🟡 Medium |
| **CSS complexities** (float, flex, grid, position) | Grok, Qwen | 🟢 Low (out of scope for v1) |
| **Form controls** (`input`, `select`) | Qwen | 🟢 Low |
| **Malformed HTML** (`dt` without `dd`) | Qwen | 🟢 Low |

---

## Rules yang Perlu Disimplify

### 1. "2×lineHeight content" → "min 2 lines"

**Raised by:** Grok, Qwen

> "2×lineHeight" is ambiguous karena varies by font/scaling. Lebih clear dengan fixed line count.

**Recommendation:** Ubah ke `minContentLines: 2`

### 2. Oversized Image Rotation

**Raised by:** Grok

> Rotate/clip terlalu invasive. Simplify ke "scale to fit + warn user" unless explicitly configured.

**Host opinion:** Keep rotation sebagai default untuk landscape images, tapi buat configurable.

### 3. Long Line Markers

**Raised by:** Qwen

> Automatic `↩`/`↪` adds parsing overhead. Better as opt-in.

**Host opinion:** Keep sebagai default, tapi expose option untuk disable.

---

## Missing Categories

| Suggested Category | Raised By | Host Decision |
|--------------------|-----------|---------------|
| **Table** (dedicated, not just `tr`) | Grok | ✅ Add - thead sticky, split only at tbody |
| **Media** (`video`, `iframe`, `svg`) | Qwen | ⚠️ Treat as Atomic for now |
| **Layout** (flex, grid) | Grok | ❌ Out of scope for v1 |
| **Interactive** (forms, buttons) | GPT | ❌ Out of scope for v1 |
| **Multi-column** | GPT | ❌ Out of scope for v1 |

---

## Key Improvements Needed

### 1. Priority/Conflict Resolution

**Raised by:** Gemini, Grok, Qwen

Perlu hierarchy yang jelas ketika rules conflict:

```
Atomic > Semantic Pairs > Heading Groups > Semantic Sequences > Containers > Prose > Line-based
```

### 2. CSS Property Integration

**Raised by:** Grok, Qwen

Respect existing CSS:
- `break-inside: avoid`
- `page-break-before/after`
- Custom: `data-folio-keep-together`

### 3. Configurable Thresholds

**Raised by:** Gemini, Grok, Qwen

Expose options:
```javascript
{
  orphanLines: 2,
  widowLines: 2,
  minContentLines: 2,
  enableLineWrapMarkers: true,
  enablePageRotation: true,
  oversizeStrategy: 'scale' | 'rotate' | 'clip'
}
```

### 4. Fallback Strategy

**Raised by:** Grok, Qwen

Untuk unresolved oversized elements:
1. Try scale
2. Try rotate (if enabled)
3. Clip as last resort
4. Log warning

### 5. Accessibility

**Raised by:** Qwen

> Clipped/rotated content might break screen readers.

Perlu ensure:
- Hidden text tetap accessible
- Split tables maintain semantic structure

---

## Host Summary

### What's Already Good

1. Mental model 7 types ✓
2. Consecutive headings handling ✓
3. Code block treatment (no orphan/widow) ✓
4. Admonition handling ✓
5. Line wrap indicators ✓

### What Needs Work

1. **Add nested container logic** - define depth-first vs breadth-first split
2. **Add Table as dedicated category** - thead sticky, split at tbody
3. **Change "2×lineHeight" to "min 2 lines"** - clearer
4. **Add priority hierarchy** - resolve rule conflicts
5. **Add CSS integration** - respect break-inside, etc.
6. **Make thresholds configurable** - expose options

### Out of Scope for v1

- Float/flex/grid layouts
- Multi-column
- Form controls
- Interactive elements
- Video/iframe (treat as atomic)

---

## Action Items

1. [ ] Update heuristics.md dengan priority hierarchy
2. [ ] Add "Table" sebagai dedicated category
3. [ ] Change "2×lineHeight" ke "minContentLines: 2"
4. [ ] Add section untuk CSS property integration
5. [ ] Add section untuk configurable options
6. [ ] Add section untuk fallback strategy
7. [ ] Add empty element handling rule
8. [ ] Add nested container clarification
