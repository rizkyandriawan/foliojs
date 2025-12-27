import type {
  PaginateOptions,
  ResolvedOptions,
  Page,
  PaginationResult,
  Orientation,
  MeasuredBlock,
} from './types.js';
import { DEFAULT_OPTIONS, PAGE_SIZES } from './types.js';
import { flattenDocument, FlatItem, findParent } from './flatten.js';

/**
 * Resolve options with defaults
 */
export function resolveOptions(options: PaginateOptions = {}): ResolvedOptions {
  const resolved = { ...DEFAULT_OPTIONS };

  if (options.pageSize && PAGE_SIZES[options.pageSize]) {
    const size = PAGE_SIZES[options.pageSize];
    resolved.pageWidth = size.width;
    resolved.pageHeight = size.height;
  }

  if (options.pageWidth) resolved.pageWidth = options.pageWidth;
  if (options.pageHeight) resolved.pageHeight = options.pageHeight;

  if (options.orientation) {
    resolved.orientation = options.orientation;
    if (options.orientation === 'landscape') {
      [resolved.pageWidth, resolved.pageHeight] = [resolved.pageHeight, resolved.pageWidth];
    }
  }

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

  resolved.contentWidth = resolved.pageWidth - resolved.padding.left - resolved.padding.right;
  resolved.contentHeight = resolved.pageHeight - resolved.padding.top - resolved.padding.bottom;

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
 * Convert FlatItem to MeasuredBlock for compatibility
 */
function flatItemToBlock(item: FlatItem): MeasuredBlock {
  return {
    element: item.element,
    type: item.type,
    height: item.height,
    marginTop: item.marginTop,
    marginBottom: item.marginBottom,
    canSplit: item.canSplit,
    forceBreakBefore: item.forceBreakBefore,
    isHeading: item.isHeading,
    headingLevel: item.headingLevel,
    lineHeight: item.lineHeight,
    lineCount: item.lineCount,
  };
}

/**
 * Main pagination algorithm using flattened document structure
 */
export async function paginate(
  container: HTMLElement,
  options: PaginateOptions = {}
): Promise<PaginationResult> {
  const resolved = resolveOptions(options);

  // Flatten the document into a linear list with depth info
  const flatItems = flattenDocument(container, resolved);

  console.log('[Paginate-Flat] Flattened items:', flatItems.map(i => ({
    tag: i.element.tagName,
    depth: i.depth,
    height: i.height,
    text: i.element.textContent?.slice(0, 30) + '...',
  })));

  // Paginate using the flat structure
  const pages: Page[] = [];
  let currentPage = createPage(0, resolved.orientation);
  let remaining = resolved.contentHeight;
  let pageStartIndex = 0;

  for (let i = 0; i < flatItems.length; i++) {
    const item = flatItems[i];
    const totalHeight = item.height + item.marginTop + item.marginBottom;

    // Force break before (H1 or CSS)
    if (item.forceBreakBefore && currentPage.fragments.length > 0) {
      pages.push(currentPage);
      currentPage = createPage(pages.length, resolved.orientation);
      remaining = resolved.contentHeight;
      pageStartIndex = i;
    }

    // Check heading + min content rule
    if (item.isHeading) {
      const minContentOk = checkHeadingMinContent(flatItems, i, remaining, resolved);
      if (!minContentOk && currentPage.fragments.length > 0) {
        pages.push(currentPage);
        currentPage = createPage(pages.length, resolved.orientation);
        remaining = resolved.contentHeight;
        pageStartIndex = i;
      }
    }

    console.log(`[Paginate-Flat] Item ${i}: ${item.element.tagName} depth=${item.depth} h=${totalHeight} remaining=${remaining} fits=${totalHeight <= remaining}`);

    if (totalHeight <= remaining) {
      // Item fits entirely
      currentPage.fragments.push({
        block: flatItemToBlock(item),
        isPartial: false,
      });
      currentPage.height += totalHeight;
      remaining -= totalHeight;
    } else {
      // Doesn't fit - find valid split point
      const splitIndex = findValidSplitPoint(flatItems, pageStartIndex, i, remaining, resolved);

      if (splitIndex >= 0 && splitIndex < i) {
        // We can split before this item - backtrack
        // Remove fragments from splitIndex onwards
        const removeCount = i - splitIndex;
        for (let j = 0; j < removeCount; j++) {
          const removed = currentPage.fragments.pop();
          if (removed) {
            currentPage.height -= removed.block.height + removed.block.marginTop + removed.block.marginBottom;
          }
        }

        // Start new page
        pages.push(currentPage);
        currentPage = createPage(pages.length, resolved.orientation);
        remaining = resolved.contentHeight;
        pageStartIndex = splitIndex;

        // Re-add items from splitIndex
        i = splitIndex - 1; // Will increment in loop
      } else {
        // Can't find valid split - start new page with this item
        if (currentPage.fragments.length > 0) {
          pages.push(currentPage);
          currentPage = createPage(pages.length, resolved.orientation);
          remaining = resolved.contentHeight;
          pageStartIndex = i;
        }

        // Add item to new page (might overflow but we can't split)
        currentPage.fragments.push({
          block: flatItemToBlock(item),
          isPartial: false,
        });
        currentPage.height += totalHeight;
        remaining = Math.max(0, remaining - totalHeight);
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
 * Check if heading has minimum content after it on the same page
 */
function checkHeadingMinContent(
  items: FlatItem[],
  headingIndex: number,
  remaining: number,
  options: ResolvedOptions
): boolean {
  const heading = items[headingIndex];
  const headingHeight = heading.height + heading.marginTop;
  const spaceAfterHeading = remaining - headingHeight;

  // Find next content item
  const nextIndex = headingIndex + 1;
  if (nextIndex >= items.length) return true;

  const nextItem = items[nextIndex];

  // Require at least minContentLines or 1/3 of the next block
  const lineHeight = nextItem.lineHeight ?? 20;
  const minByLines = options.minContentLines * lineHeight;
  const minByRatio = nextItem.height / 3;
  const minContent = Math.min(minByLines, minByRatio, nextItem.height);

  return minContent <= spaceAfterHeading;
}

/**
 * Find a valid split point within a range of items
 * Returns the index where we should start a new page, or -1 if no valid split
 */
function findValidSplitPoint(
  items: FlatItem[],
  startIndex: number,
  currentIndex: number,
  _remaining: number,
  options: ResolvedOptions
): number {
  // Walk backwards from currentIndex to find a valid split point
  for (let i = currentIndex; i > startIndex; i--) {
    const item = items[i];
    const prevItem = items[i - 1];

    // Rule 1: Don't split right after a heading
    if (prevItem.isHeading) continue;

    // Rule 2: Don't orphan semantic pairs (dt+dd, figure+figcaption)
    if (item.type === 'semantic-pair' || prevItem.type === 'semantic-pair') {
      // Check if they're related (same depth, adjacent)
      if (item.depth === prevItem.depth) continue;
    }

    // Rule 3: Keep minimum items together for sequences
    if (item.type === 'semantic-sequence' && prevItem.type === 'semantic-sequence') {
      // Count consecutive sequence items at this depth
      let beforeCount = 0;
      for (let j = i - 1; j >= startIndex; j--) {
        if (items[j].type === 'semantic-sequence' && items[j].depth === item.depth) {
          beforeCount++;
        } else if (items[j].depth < item.depth) {
          break;
        }
      }

      let afterCount = 0;
      for (let j = i; j < items.length; j++) {
        if (items[j].type === 'semantic-sequence' && items[j].depth === item.depth) {
          afterCount++;
        } else if (items[j].depth <= items[i].depth && j > i) {
          break;
        }
      }

      // Need minimum items on each side
      if (beforeCount < options.minItemsForSplit || afterCount < options.minItemsForSplit) {
        continue;
      }
    }

    // Rule 4: Check parent-child relationship
    // If current item is direct child of an item on this page, consider if parent should stay
    const parentIdx = findParent(items, i);
    if (parentIdx >= startIndex && parentIdx < i) {
      // Parent is on this page - check if we should keep them together
      const parent = items[parentIdx];

      // Headings must have some content
      if (parent.isHeading) {
        // Count content items after parent on this page
        let contentCount = 0;
        for (let j = parentIdx + 1; j < i; j++) {
          if (!items[j].isHeading) contentCount++;
        }
        if (contentCount === 0) continue; // Can't split here, would leave heading alone
      }
    }

    // This is a valid split point
    return i;
  }

  return -1;
}
