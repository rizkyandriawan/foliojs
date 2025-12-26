import type {
  PaginateOptions,
  ResolvedOptions,
  MeasuredBlock,
  Page,
  PageFragment,
  PaginationResult,
  Orientation,
} from './types.js';
import { DEFAULT_OPTIONS, PAGE_SIZES } from './types.js';
import { getBlockChildren, groupConsecutiveHeadings } from './measure.js';
import { getHandlerRegistry } from './handlers/index.js';

/**
 * Resolve options with defaults
 */
export function resolveOptions(options: PaginateOptions = {}): ResolvedOptions {
  const resolved = { ...DEFAULT_OPTIONS };

  // Page size preset
  if (options.pageSize && PAGE_SIZES[options.pageSize]) {
    const size = PAGE_SIZES[options.pageSize];
    resolved.pageWidth = size.width;
    resolved.pageHeight = size.height;
  }

  // Explicit dimensions override preset
  if (options.pageWidth) resolved.pageWidth = options.pageWidth;
  if (options.pageHeight) resolved.pageHeight = options.pageHeight;

  // Orientation
  if (options.orientation) {
    resolved.orientation = options.orientation;
    if (options.orientation === 'landscape') {
      // Swap width and height
      [resolved.pageWidth, resolved.pageHeight] = [resolved.pageHeight, resolved.pageWidth];
    }
  }

  // Padding
  if (options.padding !== undefined) {
    if (typeof options.padding === 'number') {
      resolved.padding = {
        top: options.padding,
        right: options.padding,
        bottom: options.padding,
        left: options.padding,
      };
    } else {
      resolved.padding = options.padding;
    }
  }

  // Calculate content area
  resolved.contentWidth = resolved.pageWidth - resolved.padding.left - resolved.padding.right;
  resolved.contentHeight = resolved.pageHeight - resolved.padding.top - resolved.padding.bottom;

  // Other options
  if (options.orphanLines !== undefined) resolved.orphanLines = options.orphanLines;
  if (options.widowLines !== undefined) resolved.widowLines = options.widowLines;
  if (options.minContentLines !== undefined) resolved.minContentLines = options.minContentLines;
  if (options.minItemsForSplit !== undefined) resolved.minItemsForSplit = options.minItemsForSplit;
  if (options.minRowsForSplit !== undefined) resolved.minRowsForSplit = options.minRowsForSplit;
  if (options.repeatTableHeader !== undefined) resolved.repeatTableHeader = options.repeatTableHeader;
  if (options.enableLineWrapMarkers !== undefined) resolved.enableLineWrapMarkers = options.enableLineWrapMarkers;
  if (options.oversizeStrategy !== undefined) resolved.oversizeStrategy = options.oversizeStrategy;
  if (options.enablePageRotation !== undefined) resolved.enablePageRotation = options.enablePageRotation;
  if (options.skipEmptyElements !== undefined) resolved.skipEmptyElements = options.skipEmptyElements;

  return resolved;
}

/**
 * Create a new page
 */
function createPage(index: number, orientation: Orientation): Page {
  return {
    index,
    fragments: [],
    height: 0,
    orientation,
  };
}

/**
 * Add a fragment to a page
 */
function addFragment(page: Page, fragment: PageFragment): void {
  page.fragments.push(fragment);
  page.height += fragment.block.height + fragment.block.marginTop;
}

/**
 * Create fragment for full block
 */
function fullFragment(block: MeasuredBlock): PageFragment {
  return {
    block,
    isPartial: false,
  };
}

/**
 * Create fragment for partial block (split)
 */
function partialFragment(
  block: MeasuredBlock,
  clipTop: number,
  clipHeight: number,
  startLine?: number,
  endLine?: number
): PageFragment {
  return {
    block,
    isPartial: true,
    clipTop,
    clipHeight,
    startLine,
    endLine,
  };
}

/**
 * Main pagination algorithm
 */
export async function paginate(
  container: HTMLElement,
  options: PaginateOptions = {}
): Promise<PaginationResult> {
  const resolved = resolveOptions(options);
  const registry = getHandlerRegistry();

  // Measure all blocks using handler registry
  const children = getBlockChildren(container);
  let blocks: MeasuredBlock[] = [];
  for (const child of children) {
    const measured = registry.measure(child, resolved);
    if (measured) {
      blocks.push(measured);
    }
  }

  // Group consecutive headings
  blocks = groupConsecutiveHeadings(blocks);

  // Paginate
  const pages: Page[] = [];
  let currentPage = createPage(0, resolved.orientation);
  let remaining = resolved.contentHeight;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const nextBlock = blocks[i + 1];

    // Force break before (H1 or CSS)
    if (block.forceBreakBefore && currentPage.fragments.length > 0) {
      pages.push(currentPage);
      currentPage = createPage(pages.length, resolved.orientation);
      remaining = resolved.contentHeight;
    }

    // Check heading + min content
    if (block.isHeading && !checkHeadingMinContent(block, nextBlock, remaining, resolved)) {
      // Move heading to next page
      pages.push(currentPage);
      currentPage = createPage(pages.length, resolved.orientation);
      remaining = resolved.contentHeight;
    }

    const totalHeight = block.height + block.marginTop + block.marginBottom;

    // Check fit
    if (totalHeight <= remaining) {
      // Block fits entirely
      addFragment(currentPage, fullFragment(block));
      remaining -= totalHeight;
    } else if (block.canSplit) {
      // Try to find a split point using handler
      const splitPoint = registry.findSplitPoint(block, remaining, resolved);

      if (splitPoint) {
        const sp = splitPoint;

        if (sp.type === 'line') {
          // Line-based split
          addFragment(
            currentPage,
            partialFragment(block, 0, sp.heightBefore, 0, sp.index)
          );

          pages.push(currentPage);
          currentPage = createPage(pages.length, resolved.orientation);
          remaining = resolved.contentHeight;

          addFragment(
            currentPage,
            partialFragment(block, sp.heightBefore, sp.heightAfter, sp.index, block.lineCount)
          );
          remaining -= sp.heightAfter;
        } else {
          // Child-based split (container, list, table)
          // Add first part to current page
          const firstPart: MeasuredBlock = {
            ...block,
            children: block.children?.slice(0, sp.index),
            height: sp.heightBefore,
          };
          addFragment(currentPage, fullFragment(firstPart));

          pages.push(currentPage);
          currentPage = createPage(pages.length, resolved.orientation);
          remaining = resolved.contentHeight;

          // Add second part to new page
          const secondPart: MeasuredBlock = {
            ...block,
            children: block.children?.slice(sp.index),
            height: sp.heightAfter,
          };

          // For tables: only include thead in continuation if repeatTableHeader is true
          if (block.type === 'table' && !resolved.repeatTableHeader) {
            secondPart.thead = undefined;
            secondPart.theadHeight = undefined;
          }

          addFragment(currentPage, fullFragment(secondPart));
          remaining -= sp.heightAfter;
        }
      } else {
        // Can't split, move to next page
        if (currentPage.fragments.length > 0) {
          pages.push(currentPage);
          currentPage = createPage(pages.length, resolved.orientation);
          remaining = resolved.contentHeight;
        }
        addFragment(currentPage, fullFragment(block));
        remaining -= totalHeight;
      }
    } else {
      // Can't split, move to next page
      if (currentPage.fragments.length > 0) {
        pages.push(currentPage);
        currentPage = createPage(pages.length, resolved.orientation);
        remaining = resolved.contentHeight;
      }

      // Handle oversized elements
      if (totalHeight > resolved.contentHeight) {
        // TODO: Handle oversized based on strategy
        // For now, just add it and let it overflow
        addFragment(currentPage, fullFragment(block));
        remaining = 0;
      } else {
        addFragment(currentPage, fullFragment(block));
        remaining -= totalHeight;
      }
    }
  }

  // Add last page if it has content
  if (currentPage.fragments.length > 0) {
    pages.push(currentPage);
  }

  return {
    pages,
    totalPages: pages.length,
    options: resolved,
  };
}

/**
 * Check if heading group needs min content after it
 * Returns false if heading should move to next page
 */
function checkHeadingMinContent(
  block: MeasuredBlock,
  nextBlock: MeasuredBlock | undefined,
  remaining: number,
  options: ResolvedOptions
): boolean {
  if (!block.isHeading) return true;
  if (!nextBlock) return true;

  const headingHeight = block.height + block.marginTop;
  const spaceAfterHeading = remaining - headingHeight;

  // If next block can't split, require the whole block to fit
  if (!nextBlock.canSplit) {
    const nextHeight = nextBlock.height + nextBlock.marginTop;
    return nextHeight <= spaceAfterHeading;
  }

  // For splittable blocks, require at least minContentLines or 1/3 of the block
  const lineHeight = nextBlock.lineHeight ?? 20;
  const minByLines = options.minContentLines * lineHeight;
  const minByRatio = nextBlock.height / 3;
  const minContent = Math.max(minByLines, minByRatio);

  return minContent <= spaceAfterHeading;
}
