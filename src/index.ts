// Core types
export type {
  ElementType,
  PageSizePreset,
  Orientation,
  OversizeStrategy,
  PaginateOptions,
  ResolvedOptions,
  MeasuredBlock,
  PageFragment,
  Page,
  PaginationResult,
} from './types.js';

export { PAGE_SIZES, DEFAULT_OPTIONS } from './types.js';

// Main API
export { paginate, resolveOptions } from './paginate.js';

// Measurement utilities
export {
  measureBlocks,
  measureElement,
  getElementType,
  isEmpty,
  getBlockChildren,
} from './measure.js';

// Heuristics
export {
  checkFit,
  findSplitPoint,
  checkHeadingMinContent,
  shouldRotateForImage,
  getRowspanGroups,
} from './heuristics.js';

// Web Component
export { FolioElement } from './folio-element.js';
