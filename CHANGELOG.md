# Changelog

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
