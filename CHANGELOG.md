# Changelog

## [0.2.1] - 2025-12-28

### Added
- Code block splitting: per-line with continuation indicators (`↪ continued` / `continues ↩`)
- Paragraph splitting: per-sentence, or per 6 words for long sentences (>10 words)

### Fixed
- Table split constraint: now allows split with 1+ fitted rows (was requiring minRowsForSplit)
- Bottom padding increased to 108px for better page balance

## [0.2.0] - 2025-12-27

### Added
- **V2 Pagination Algorithm** (now default) - "fill until overflow" approach
  - Simpler and more accurate: adds elements one by one until overflow, then splits
  - No full-element measurement before adding - measures only after adding atomic content
  - Recursive splitting for nested lists without premature overflow detection
- Table splitting with `<thead>` repetition on each page
- Trailing heading rule: headings at page end automatically move to next page
- `algorithm` attribute to switch between `v1` (pre-measure) and `v2` (fill-overflow)

### Changed
- Default algorithm changed from V1 to V2
- Lists (`<ul>`, `<ol>`) now go straight to split mode without measuring full list first
- Nested list handling: only measures after adding `<li>` content, not container

### Fixed
- Height measurement now uses source container's CSS inheritance (fixes styling issues)
- Min items rule for lists: 2+ items OR 1 item with height >= 70px

## [0.1.1] - 2025-12-27

### Fixed
- Fixed list/table/container split causing duplicate content. Child-based splits now correctly use `isPartial: true` so render functions properly clone only the subset of children instead of the entire element.

## [0.1.0] - 2025-12-27

### Added
- Initial release
- DOM-first pagination with real measurement
- Handler system for different element types (prose, code, list, table, container, heading, atomic)
- Smart heuristics for page breaks
- `<folio-pages>` custom element
- `toPrintHTML()` method for PDF generation workflows
- Support for A4, Letter, Legal page sizes
- Configurable margins and padding
