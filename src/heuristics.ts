import type { MeasuredBlock, ResolvedOptions } from './types.js';

/**
 * Result of checking if a block fits
 */
export interface FitResult {
  fits: boolean;
  canSplit: boolean;
  splitPoint?: SplitPoint;
}

/**
 * Information about where to split a block
 */
export interface SplitPoint {
  type: 'line' | 'child';
  index: number;
  heightBefore: number;
  heightAfter: number;
}

/**
 * Check if a block fits in the remaining space
 */
export function checkFit(
  block: MeasuredBlock,
  remaining: number,
  options: ResolvedOptions
): FitResult {
  const totalHeight = block.height + block.marginTop;

  if (totalHeight <= remaining) {
    return { fits: true, canSplit: false };
  }

  if (!block.canSplit) {
    return { fits: false, canSplit: false };
  }

  // Try to find a split point
  const splitPoint = findSplitPoint(block, remaining, options);

  return {
    fits: false,
    canSplit: splitPoint !== null,
    splitPoint: splitPoint ?? undefined,
  };
}

/**
 * Find optimal split point within a block
 */
export function findSplitPoint(
  block: MeasuredBlock,
  available: number,
  options: ResolvedOptions
): SplitPoint | null {
  switch (block.type) {
    case 'prose':
      return findProseSplitPoint(block, available, options);

    case 'line-based':
      return findLineSplitPoint(block, available);

    case 'container':
      return findContainerSplitPoint(block, available, options);

    case 'semantic-sequence':
      return findSequenceSplitPoint(block, available, options);

    case 'table':
      return findTableSplitPoint(block, available, options);

    default:
      return null;
  }
}

/**
 * Find split point for prose (paragraph) with orphan/widow rules
 */
function findProseSplitPoint(
  block: MeasuredBlock,
  available: number,
  options: ResolvedOptions
): SplitPoint | null {
  const { lineCount, lineHeight } = block;
  if (!lineCount || !lineHeight) return null;

  const minLines = options.orphanLines + options.widowLines;
  if (lineCount < minLines) return null;

  const linesInAvailable = Math.floor(available / lineHeight);

  // Check orphan constraint
  if (linesInAvailable < options.orphanLines) return null;

  // Check widow constraint
  const linesRemaining = lineCount - linesInAvailable;
  if (linesRemaining < options.widowLines) {
    // Adjust to leave enough for widows
    const adjustedLines = lineCount - options.widowLines;
    if (adjustedLines < options.orphanLines) return null;

    return {
      type: 'line',
      index: adjustedLines,
      heightBefore: adjustedLines * lineHeight,
      heightAfter: options.widowLines * lineHeight,
    };
  }

  return {
    type: 'line',
    index: linesInAvailable,
    heightBefore: linesInAvailable * lineHeight,
    heightAfter: linesRemaining * lineHeight,
  };
}

/**
 * Find split point for line-based content (code blocks)
 * No orphan/widow constraints
 */
function findLineSplitPoint(
  block: MeasuredBlock,
  available: number
): SplitPoint | null {
  const { lineCount, lineHeight } = block;
  if (!lineCount || !lineHeight) return null;

  const linesInAvailable = Math.floor(available / lineHeight);
  if (linesInAvailable < 1) return null;

  const linesRemaining = lineCount - linesInAvailable;
  if (linesRemaining < 1) return null;

  return {
    type: 'line',
    index: linesInAvailable,
    heightBefore: linesInAvailable * lineHeight,
    heightAfter: linesRemaining * lineHeight,
  };
}

/**
 * Find split point for containers (blockquote, div, etc.)
 */
function findContainerSplitPoint(
  block: MeasuredBlock,
  available: number,
  _options: ResolvedOptions
): SplitPoint | null {
  const children = block.children;
  if (!children || children.length < 2) return null;

  let cumHeight = 0;
  let splitIndex = -1;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childHeight = child.height + child.marginTop + child.marginBottom;

    if (cumHeight + childHeight > available) {
      // Can't fit this child, split before it
      if (i > 0) {
        splitIndex = i;
      }
      break;
    }

    cumHeight += childHeight;

    // Check if child itself can be split
    if (cumHeight <= available && i === children.length - 1) {
      // All children fit
      return null;
    }
  }

  if (splitIndex < 1) return null;

  // Calculate heights
  let heightBefore = 0;
  for (let i = 0; i < splitIndex; i++) {
    const child = children[i];
    heightBefore += child.height + child.marginTop + child.marginBottom;
  }

  let heightAfter = 0;
  for (let i = splitIndex; i < children.length; i++) {
    const child = children[i];
    heightAfter += child.height + child.marginTop + child.marginBottom;
  }

  return {
    type: 'child',
    index: splitIndex,
    heightBefore,
    heightAfter,
  };
}

/**
 * Find split point for semantic sequences (li, tr)
 */
function findSequenceSplitPoint(
  block: MeasuredBlock,
  available: number,
  options: ResolvedOptions
): SplitPoint | null {
  const children = block.children;
  if (!children || children.length < options.minItemsForSplit) return null;

  let cumHeight = 0;
  let splitIndex = -1;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childHeight = child.height + child.marginTop + child.marginBottom;

    if (cumHeight + childHeight > available) {
      splitIndex = i;
      break;
    }

    cumHeight += childHeight;
  }

  // Ensure min items on each side
  if (splitIndex < 1) return null;
  if (children.length - splitIndex < 1) return null;

  // Calculate heights
  let heightBefore = 0;
  for (let i = 0; i < splitIndex; i++) {
    const child = children[i];
    heightBefore += child.height + child.marginTop + child.marginBottom;
  }

  let heightAfter = 0;
  for (let i = splitIndex; i < children.length; i++) {
    const child = children[i];
    heightAfter += child.height + child.marginTop + child.marginBottom;
  }

  return {
    type: 'child',
    index: splitIndex,
    heightBefore,
    heightAfter,
  };
}

/**
 * Find split point for tables
 * THEAD + at least minRowsForSplit rows must stay together
 */
function findTableSplitPoint(
  block: MeasuredBlock,
  available: number,
  options: ResolvedOptions
): SplitPoint | null {
  const rows = block.children;
  if (!rows || rows.length < options.minRowsForSplit * 2) return null;

  const theadHeight = block.theadHeight || 0;
  let cumHeight = theadHeight; // Start with thead height
  let splitIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowHeight = row.height + row.marginTop + row.marginBottom;

    if (cumHeight + rowHeight > available) {
      // Can't fit this row
      // Make sure we have at least minRowsForSplit on current page
      if (i >= options.minRowsForSplit) {
        splitIndex = i;
      }
      break;
    }

    cumHeight += rowHeight;
  }

  // Make sure we leave at least minRowsForSplit for next page
  if (splitIndex < 0) return null;
  if (rows.length - splitIndex < options.minRowsForSplit) {
    splitIndex = rows.length - options.minRowsForSplit;
    if (splitIndex < options.minRowsForSplit) return null;
  }

  // Calculate heights
  let heightBefore = theadHeight;
  for (let i = 0; i < splitIndex; i++) {
    const row = rows[i];
    heightBefore += row.height + row.marginTop + row.marginBottom;
  }

  let heightAfter = theadHeight; // Include thead in second part too if repeatTableHeader
  for (let i = splitIndex; i < rows.length; i++) {
    const row = rows[i];
    heightAfter += row.height + row.marginTop + row.marginBottom;
  }

  return {
    type: 'child',
    index: splitIndex,
    heightBefore,
    heightAfter,
  };
}

/**
 * Check if heading group needs min content after it
 */
export function checkHeadingMinContent(
  block: MeasuredBlock,
  nextBlock: MeasuredBlock | undefined,
  remaining: number,
  options: ResolvedOptions
): boolean {
  if (!block.isHeading) return true;

  const lineHeight = nextBlock?.lineHeight ?? 20;
  const minContent = options.minContentLines * lineHeight;
  const needed = block.height + block.marginTop + minContent;

  return needed <= remaining;
}

/**
 * Determine if image should trigger landscape page
 */
export function shouldRotateForImage(
  img: HTMLImageElement,
  options: ResolvedOptions
): boolean {
  if (!options.enablePageRotation) return false;

  const ratio = img.naturalWidth / img.naturalHeight;
  return ratio > 1.2; // Clearly landscape
}

/**
 * Check for rowspan in table rows
 */
export function getRowspanGroups(table: HTMLTableElement): number[][] {
  const groups: number[][] = [];
  const rows = table.querySelectorAll('tbody tr');
  const activeRowspans = new Map<number, number>(); // col -> remaining rows

  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('td, th');
    let colIndex = 0;

    cells.forEach((cell) => {
      // Skip columns with active rowspans
      while (activeRowspans.has(colIndex) && activeRowspans.get(colIndex)! > 0) {
        colIndex++;
      }

      const rowspan = parseInt(cell.getAttribute('rowspan') || '1');
      if (rowspan > 1) {
        activeRowspans.set(colIndex, rowspan - 1);

        // Find or create group
        let foundGroup = false;
        for (const group of groups) {
          if (group.includes(rowIndex)) {
            foundGroup = true;
            for (let i = 1; i < rowspan; i++) {
              if (!group.includes(rowIndex + i)) {
                group.push(rowIndex + i);
              }
            }
            break;
          }
        }

        if (!foundGroup) {
          const newGroup = [rowIndex];
          for (let i = 1; i < rowspan; i++) {
            newGroup.push(rowIndex + i);
          }
          groups.push(newGroup);
        }
      }

      colIndex++;
    });

    // Decrement active rowspans
    activeRowspans.forEach((count, col) => {
      if (count > 0) {
        activeRowspans.set(col, count - 1);
      }
    });
  });

  return groups;
}
