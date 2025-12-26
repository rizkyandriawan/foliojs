# Folio Pagination Heuristics Review

Kamu adalah reviewer untuk library pagination DOM-based bernama Folio. Review heuristics berikut dan berikan feedback:

## Simplified Mental Model

| Type | Elements | Treatment |
|------|----------|-----------|
| **Line-based** | `pre`, `code` | Split anywhere between lines, padding at edges |
| **Prose** | `p` | Orphan/widow rules apply (min 2 lines each side) |
| **Container** | `blockquote`, `div`, admonitions | Split between children, padding at edges |
| **Semantic pairs** | `dt`+`dd`, `figure`+`figcaption` | Keep together, never split |
| **Semantic sequence** | `li`, `tr` | Keep min 1-2 each side |
| **Atomic** | `img`, `hr`, `math`, `diagram` | Never split (scale/rotate/clip if oversized) |
| **Heading group** | consecutive `h1`-`h6` | Keep all + minContent together |

## Key Rules

1. **Consecutive headings** (H2→H3→H4) = satu unit, harus stay together + 2×lineHeight content setelahnya
2. **Code blocks** = sequence of lines, split anywhere, no orphan/widow (code bukan prose)
3. **Long lines** di code/table = wrap dengan `↩` di akhir, `↪` di awal continuation
4. **Oversized images** landscape = rotate page ke landscape; portrait = clip vertically
5. **Oversized table rows** = rotate page ke landscape
6. **Admonitions** = title + first content = unit, sisanya splittable

## Questions

1. Apakah ada edge case yang terlewat?
2. Apakah ada rule yang terlalu kompleks dan bisa disimplify?
3. Apakah categorization ke 7 types sudah comprehensive?
4. Ada saran improvement?

Be concise, critical, and specific.
