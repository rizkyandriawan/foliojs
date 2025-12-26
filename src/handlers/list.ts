import { BaseHandler, SplitPoint } from './base.js';
import type { MeasuredBlock, ResolvedOptions } from '../types.js';

/**
 * Handler for lists (ul, ol) and their items
 * Ensures minimum items on each side of split
 */
export class ListHandler extends BaseHandler {
  readonly type = 'semantic-sequence' as const;

  canHandle(el: HTMLElement): boolean {
    return el.tagName === 'UL' || el.tagName === 'OL';
  }

  measure(el: HTMLElement, options: ResolvedOptions): MeasuredBlock {
    const block = super.measure(el, options);

    // Measure list items
    const items = el.querySelectorAll(':scope > li');
    if (items.length > 0) {
      block.children = Array.from(items).map(item => this.measureItem(item as HTMLElement));

      // Can split if enough items
      block.canSplit = items.length >= options.minItemsForSplit * 2 && this.getCSSBreakInside(el) !== 'avoid';
    } else {
      block.canSplit = false;
    }

    return block;
  }

  private measureItem(el: HTMLElement): MeasuredBlock {
    const style = getComputedStyle(el);

    return {
      element: el,
      type: 'semantic-sequence',
      height: el.offsetHeight,
      marginTop: parseFloat(style.marginTop) || 0,
      marginBottom: parseFloat(style.marginBottom) || 0,
      canSplit: false,
      forceBreakBefore: false,
      isHeading: false,
    };
  }

  canSplit(block: MeasuredBlock, options: ResolvedOptions): boolean {
    const items = block.children;
    if (!items) return false;
    return items.length >= options.minItemsForSplit * 2;
  }

  findSplitPoint(block: MeasuredBlock, available: number, options: ResolvedOptions): SplitPoint | null {
    const items = block.children;
    if (!items || items.length < options.minItemsForSplit * 2) return null;

    let cumHeight = 0;
    let splitIndex = -1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemHeight = item.height + item.marginTop + item.marginBottom;

      if (cumHeight + itemHeight > available) {
        // Can't fit this item - check if we have enough
        if (i >= options.minItemsForSplit) {
          splitIndex = i;
        }
        break;
      }

      cumHeight += itemHeight;
    }

    if (splitIndex < 0) return null;

    // Ensure minimum items for next page
    if (items.length - splitIndex < options.minItemsForSplit) {
      splitIndex = items.length - options.minItemsForSplit;
      if (splitIndex < options.minItemsForSplit) return null;
    }

    // Calculate heights
    let heightBefore = 0;
    for (let i = 0; i < splitIndex; i++) {
      const item = items[i];
      heightBefore += item.height + item.marginTop + item.marginBottom;
    }

    let heightAfter = 0;
    for (let i = splitIndex; i < items.length; i++) {
      const item = items[i];
      heightAfter += item.height + item.marginTop + item.marginBottom;
    }

    return {
      type: 'child',
      index: splitIndex,
      heightBefore,
      heightAfter,
    };
  }

  render(block: MeasuredBlock, isPartial: boolean): HTMLElement {
    const sourceEl = block.element;

    // If this is a split list
    if (isPartial && block.children) {
      const originalItemCount = sourceEl.querySelectorAll(':scope > li').length;
      if (block.children.length < originalItemCount) {
        const clone = sourceEl.cloneNode(false) as HTMLElement;

        for (const itemBlock of block.children) {
          const itemClone = itemBlock.element.cloneNode(true) as HTMLElement;
          clone.appendChild(itemClone);
        }

        return clone;
      }
    }

    return sourceEl.cloneNode(true) as HTMLElement;
  }
}
