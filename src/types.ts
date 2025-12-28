/**
 * Element classification for pagination heuristics
 */
export type ElementType =
  | 'atomic'           // Never split: img, hr, math, svg
  | 'prose'            // Orphan/widow rules: p
  | 'line-based'       // Split anywhere: pre, code
  | 'container'        // Split between children: blockquote, div
  | 'semantic-pair'    // Keep together: figure+figcaption, dt+dd
  | 'semantic-sequence'// Min items each side: li, tr
  | 'heading-group'    // Consecutive headings + minContent
  | 'table';           // Tables: split by rows, keep thead with body

/**
 * Page size presets
 */
export type PageSizePreset = 'A4' | 'Letter' | 'Legal';

/**
 * Page orientation
 */
export type Orientation = 'portrait' | 'landscape';

/**
 * Strategy for handling oversized elements
 */
export type OversizeStrategy = 'scale' | 'rotate' | 'clip';

/**
 * Pagination options
 */
export interface PaginateOptions {
  // Dimensions
  pageHeight?: number;
  pageWidth?: number;
  pageSize?: PageSizePreset;
  orientation?: Orientation;
  padding?: number | { top: number; right: number; bottom: number; left: number };

  // Orphan/Widow
  orphanLines?: number;
  widowLines?: number;
  minContentLines?: number;

  // Lists & Tables
  minItemsForSplit?: number;
  minRowsForSplit?: number;
  repeatTableHeader?: boolean;

  // Visual
  enableLineWrapMarkers?: boolean;

  // Oversized handling
  oversizeStrategy?: OversizeStrategy;
  enablePageRotation?: boolean;

  // Empty elements
  skipEmptyElements?: boolean;
}

/**
 * Resolved options with defaults applied
 */
export interface ResolvedOptions {
  pageHeight: number;
  pageWidth: number;
  contentHeight: number;
  contentWidth: number;
  padding: { top: number; right: number; bottom: number; left: number };
  orientation: Orientation;
  orphanLines: number;
  widowLines: number;
  minContentLines: number;
  minItemsForSplit: number;
  minRowsForSplit: number;
  repeatTableHeader: boolean;
  enableLineWrapMarkers: boolean;
  oversizeStrategy: OversizeStrategy;
  enablePageRotation: boolean;
  skipEmptyElements: boolean;
}

/**
 * Measured block information
 */
export interface MeasuredBlock {
  element: HTMLElement;
  type: ElementType;
  height: number;
  marginTop: number;
  marginBottom: number;
  lineCount?: number;
  lineHeight?: number;
  children?: MeasuredBlock[];
  canSplit: boolean;
  forceBreakBefore: boolean;
  isHeading: boolean;
  headingLevel?: number;
  // Table-specific
  thead?: HTMLElement;
  theadHeight?: number;
}

/**
 * A fragment of content on a page
 */
export interface PageFragment {
  block: MeasuredBlock;
  isPartial: boolean;
  clipTop?: number;
  clipHeight?: number;
  startLine?: number;
  endLine?: number;
}

/**
 * A single page
 */
export interface Page {
  index: number;
  fragments: PageFragment[];
  height: number;
  orientation: Orientation;
}

/**
 * Pagination result
 */
export interface PaginationResult {
  pages: Page[];
  totalPages: number;
  options: ResolvedOptions;
}

/**
 * Page size dimensions in pixels (96 DPI)
 */
export const PAGE_SIZES: Record<PageSizePreset, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },      // 210mm x 297mm
  Letter: { width: 816, height: 1056 },  // 8.5in x 11in
  Legal: { width: 816, height: 1344 },   // 8.5in x 14in
};

/**
 * Default options
 */
export const DEFAULT_OPTIONS: ResolvedOptions = {
  pageHeight: PAGE_SIZES.A4.height,
  pageWidth: PAGE_SIZES.A4.width,
  contentHeight: PAGE_SIZES.A4.height - 188, // 80px top + 108px bottom
  contentWidth: PAGE_SIZES.A4.width - 160,
  padding: { top: 80, right: 80, bottom: 108, left: 80 },
  orientation: 'portrait',
  orphanLines: 2,
  widowLines: 2,
  minContentLines: 2,
  minItemsForSplit: 2,
  minRowsForSplit: 2,
  repeatTableHeader: false,
  enableLineWrapMarkers: true,
  oversizeStrategy: 'scale',
  enablePageRotation: true,
  skipEmptyElements: true,
};
