import { BaseHandler, SplitPoint } from './base.js';
import type { MeasuredBlock, ResolvedOptions } from '../types.js';

/**
 * Handler for tables with proper row-based splitting
 * Keeps thead with tbody, respects minRowsForSplit
 */
export class TableHandler extends BaseHandler {
  readonly type = 'table' as const;

  canHandle(el: HTMLElement): boolean {
    return el.tagName === 'TABLE';
  }

  measure(el: HTMLElement, options: ResolvedOptions): MeasuredBlock {
    const block = super.measure(el, options);
    const table = el as HTMLTableElement;

    // Get thead info
    const thead = table.querySelector('thead');
    if (thead) {
      block.thead = thead as HTMLElement;
      block.theadHeight = thead.offsetHeight;
    }

    // Measure rows (children)
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length > 0) {
      block.children = Array.from(rows).map(row => this.measureRow(row as HTMLElement));

      // Can split if enough rows
      block.canSplit = rows.length >= options.minRowsForSplit * 2;
    } else {
      block.canSplit = false;
    }

    return block;
  }

  private measureRow(row: HTMLElement): MeasuredBlock {
    const style = getComputedStyle(row);

    return {
      element: row,
      type: 'semantic-sequence',
      height: row.offsetHeight,
      marginTop: parseFloat(style.marginTop) || 0,
      marginBottom: parseFloat(style.marginBottom) || 0,
      canSplit: false,
      forceBreakBefore: false,
      isHeading: false,
    };
  }

  canSplit(block: MeasuredBlock, options: ResolvedOptions): boolean {
    const rows = block.children;
    if (!rows) return false;
    return rows.length >= options.minRowsForSplit * 2;
  }

  findSplitPoint(block: MeasuredBlock, available: number, options: ResolvedOptions): SplitPoint | null {
    const rows = block.children;
    if (!rows || rows.length < options.minRowsForSplit * 2) return null;

    const theadHeight = block.theadHeight || 0;
    let cumHeight = theadHeight;
    let splitIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowHeight = row.height + row.marginTop + row.marginBottom;

      if (cumHeight + rowHeight > available) {
        // Can't fit this row - split before it if we have enough rows
        if (i >= options.minRowsForSplit) {
          splitIndex = i;
        }
        break;
      }

      cumHeight += rowHeight;
    }

    if (splitIndex < 0) return null;

    // Ensure we leave enough rows for next page
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

    let heightAfter = theadHeight; // thead repeats on continuation
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

  render(block: MeasuredBlock, isPartial: boolean): HTMLElement {
    const originalTable = block.element as HTMLTableElement;

    // If not a partial (split) table, just clone the whole thing
    if (!isPartial && block.children) {
      const originalRowCount = originalTable.querySelectorAll('tbody tr').length;
      if (block.children.length === originalRowCount) {
        return originalTable.cloneNode(true) as HTMLElement;
      }
    }

    // Build a new table with only the relevant rows
    const clone = document.createElement('table');

    // Copy table attributes
    for (const attr of originalTable.attributes) {
      clone.setAttribute(attr.name, attr.value);
    }

    // Add thead (always include in split tables)
    if (block.thead) {
      const theadClone = block.thead.cloneNode(true) as HTMLElement;
      clone.appendChild(theadClone);
    }

    // Create tbody with only the rows in this fragment
    const tbody = document.createElement('tbody');
    for (const rowBlock of block.children || []) {
      const rowClone = rowBlock.element.cloneNode(true) as HTMLElement;
      tbody.appendChild(rowClone);
    }
    clone.appendChild(tbody);

    return clone;
  }
}
