import { BaseHandler, SplitPoint } from './base.js';
import type { MeasuredBlock, ResolvedOptions } from '../types.js';

/**
 * Flattened list item for linear splitting
 */
interface FlatItem {
  element: HTMLElement;      // The LI element
  depth: number;             // Nesting level (0 = top level)
  contentHeight: number;     // Height of just this LI's content (text, not nested lists)
  marginTop: number;
  marginBottom: number;
  hasNestedList: boolean;    // Does this LI contain a nested UL/OL?
  nestedListOverhead: number; // Padding/margin of nested list (if any)
  leadingOverhead: number;   // Overhead needed if this item starts a page (from ancestor nesting)
  nestedListTag?: 'ul' | 'ol'; // Tag of nested list if any
  parentListTag: 'ul' | 'ol';  // Tag of parent list
}

/**
 * Handler for lists (ul, ol) and their items
 * Uses flattened approach for nested list splitting
 */
export class ListHandler extends BaseHandler {
  readonly type = 'semantic-sequence' as const;

  canHandle(el: HTMLElement): boolean {
    return el.tagName === 'UL' || el.tagName === 'OL';
  }

  measure(el: HTMLElement, options: ResolvedOptions): MeasuredBlock {
    const block = super.measure(el, options);

    // Flatten all list items recursively
    const flatItems = this.flattenList(el, 0);

    if (flatItems.length > 0) {
      // Store flat items as children (we'll use custom properties)
      block.children = flatItems.map(item => ({
        element: item.element,
        type: 'semantic-sequence' as const,
        height: item.contentHeight,
        marginTop: item.marginTop,
        marginBottom: item.marginBottom,
        canSplit: false,
        forceBreakBefore: false,
        isHeading: false,
        // Store flat item data in custom property
        _flatItem: item,
      }));

      // Can split if we have enough items total
      block.canSplit = flatItems.length >= options.minItemsForSplit * 2 &&
                       this.getCSSBreakInside(el) !== 'avoid';
    } else {
      block.canSplit = false;
    }

    return block;
  }

  /**
   * Recursively flatten all LIs in a list
   * @param cumulativeOverhead - accumulated overhead from ancestor nesting
   */
  private flattenList(listEl: HTMLElement, depth: number, cumulativeOverhead: number = 0): FlatItem[] {
    const items: FlatItem[] = [];
    const listTag = listEl.tagName.toLowerCase() as 'ul' | 'ol';
    const directLis = listEl.querySelectorAll(':scope > li');

    for (const li of directLis) {
      const liEl = li as HTMLElement;
      const style = getComputedStyle(liEl);

      // Check for nested list
      const nestedList = liEl.querySelector(':scope > ul, :scope > ol') as HTMLElement | null;

      // Calculate content height (excluding nested list)
      let contentHeight = liEl.offsetHeight;
      let nestedListOverhead = 0; // padding/margin of nested list itself
      if (nestedList) {
        // Height before nested list starts
        contentHeight = nestedList.offsetTop - liEl.offsetTop;

        // Calculate nested list overhead (its own padding/margin not counted in children)
        const nestedStyle = getComputedStyle(nestedList);
        const nestedPaddingTop = parseFloat(nestedStyle.paddingTop) || 0;
        const nestedPaddingBottom = parseFloat(nestedStyle.paddingBottom) || 0;
        const nestedMarginTop = parseFloat(nestedStyle.marginTop) || 0;
        const nestedMarginBottom = parseFloat(nestedStyle.marginBottom) || 0;
        nestedListOverhead = nestedPaddingTop + nestedPaddingBottom + nestedMarginTop + nestedMarginBottom;
      }

      // leadingOverhead = cumulative overhead if this item starts a page
      const leadingOverhead = cumulativeOverhead;

      const words = liEl.textContent?.trim().split(/\s+/).slice(0, 3).join(' ') || '';
      console.log(`[Flatten] depth=${depth} fullH=${liEl.offsetHeight} contentH=${contentHeight} overhead=${nestedListOverhead} leading=${leadingOverhead} nested=${!!nestedList} "${words}"`);
      items.push({
        element: liEl,
        depth,
        contentHeight: Math.max(0, contentHeight),
        marginTop: parseFloat(style.marginTop) || 0,
        marginBottom: nestedList ? 0 : (parseFloat(style.marginBottom) || 0), // No margin if has nested
        hasNestedList: !!nestedList,
        nestedListOverhead,
        leadingOverhead,
        nestedListTag: nestedList ? nestedList.tagName.toLowerCase() as 'ul' | 'ol' : undefined,
        parentListTag: listTag,
      });

      // Recursively flatten nested list with accumulated overhead
      if (nestedList) {
        const nestedItems = this.flattenList(nestedList, depth + 1, cumulativeOverhead + nestedListOverhead);
        items.push(...nestedItems);

        // Add the "closing" margin of the parent LI after nested items
        const lastNestedIdx = items.length - 1;
        if (lastNestedIdx >= 0) {
          items[lastNestedIdx].marginBottom += parseFloat(style.marginBottom) || 0;
        }
      }
    }

    return items;
  }

  canSplit(block: MeasuredBlock, options: ResolvedOptions): boolean {
    const items = block.children;
    if (!items) return false;
    return items.length >= options.minItemsForSplit * 2;
  }

  findSplitPoint(block: MeasuredBlock, available: number, options: ResolvedOptions): SplitPoint | null {
    const items = block.children;
    if (!items || items.length < options.minItemsForSplit * 2) return null;

    // Account for list padding
    const style = getComputedStyle(block.element);
    const listPaddingTop = parseFloat(style.paddingTop) || 0;
    const listPaddingBottom = parseFloat(style.paddingBottom) || 0;

    let cumHeight = listPaddingTop;
    let splitIndex = -1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const flatItem = (item as any)._flatItem as FlatItem;

      // Add overhead when entering nested list or for first item
      let extraPadding = 0;
      if (i === 0) {
        // First item - use its leadingOverhead (accumulated from ancestors)
        extraPadding = flatItem.leadingOverhead;
      } else {
        const prevFlatItem = (items[i - 1] as any)._flatItem as FlatItem;
        if (flatItem.depth > prevFlatItem.depth && prevFlatItem.hasNestedList) {
          // Entering nested list - add parent's nestedListOverhead
          extraPadding = prevFlatItem.nestedListOverhead;
        }
      }

      const itemHeight = item.height + item.marginTop + item.marginBottom + extraPadding;
      const words = item.element.textContent?.trim().split(/\s+/).slice(0, 2).join(' ') || '';
      console.log(`[Split] i=${i} depth=${flatItem.depth} h=${itemHeight} cum=${cumHeight} avail=${available} fits=${cumHeight + itemHeight <= available} "${words}"`);

      if (cumHeight + itemHeight > available) {
        // Can't fit this item
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

    // Calculate heights (including nestedListOverhead)
    let heightBefore = listPaddingTop;
    for (let i = 0; i < splitIndex; i++) {
      const item = items[i];
      const flatItem = (item as any)._flatItem as FlatItem;
      let extra = 0;
      if (i > 0) {
        const prevFlatItem = (items[i - 1] as any)._flatItem as FlatItem;
        if (flatItem.depth > prevFlatItem.depth && prevFlatItem.hasNestedList) {
          extra = prevFlatItem.nestedListOverhead;
        }
      }
      heightBefore += item.height + item.marginTop + item.marginBottom + extra;
    }
    heightBefore += listPaddingBottom;

    let heightAfter = listPaddingTop;
    for (let i = splitIndex; i < items.length; i++) {
      const item = items[i];
      const flatItem = (item as any)._flatItem as FlatItem;
      let extra = 0;
      if (i === splitIndex) {
        // First item of second part - use its leadingOverhead
        extra = flatItem.leadingOverhead;
      } else {
        const prevFlatItem = (items[i - 1] as any)._flatItem as FlatItem;
        if (flatItem.depth > prevFlatItem.depth && prevFlatItem.hasNestedList) {
          extra = prevFlatItem.nestedListOverhead;
        }
      }
      heightAfter += item.height + item.marginTop + item.marginBottom + extra;
    }
    heightAfter += listPaddingBottom;

    console.log(`[Split] Result: index=${splitIndex} heightBefore=${heightBefore} heightAfter=${heightAfter} total=${heightBefore + heightAfter}`);
    return {
      type: 'child',
      index: splitIndex,
      heightBefore,
      heightAfter,
    };
  }

  render(block: MeasuredBlock, isPartial: boolean): HTMLElement {
    const sourceEl = block.element;

    if (!isPartial || !block.children) {
      return sourceEl.cloneNode(true) as HTMLElement;
    }

    // Get flat items from children
    const flatItems = block.children.map(c => (c as any)._flatItem as FlatItem);

    // Reconstruct nested structure from flat items
    return this.reconstructList(sourceEl, flatItems);
  }

  /**
   * Reconstruct nested list structure from flat items
   */
  private reconstructList(originalList: HTMLElement, flatItems: FlatItem[]): HTMLElement {
    if (flatItems.length === 0) {
      return originalList.cloneNode(false) as HTMLElement;
    }

    // Root list clone
    const rootList = originalList.cloneNode(false) as HTMLElement;

    // Stack to track open lists at each depth
    // stack[0] = root list, stack[1] = first nested list, etc.
    const listStack: HTMLElement[] = [rootList];
    const liStack: HTMLElement[] = []; // Track parent LIs for each depth

    let currentDepth = 0;

    for (const item of flatItems) {
      // Adjust depth - close lists if going up
      while (currentDepth > item.depth) {
        listStack.pop();
        liStack.pop();
        currentDepth--;
      }

      // Open new nested lists if going deeper
      while (currentDepth < item.depth) {
        // We need a parent LI to attach nested list to
        // This shouldn't happen if data is correct, but handle gracefully
        if (liStack.length === 0) {
          // Create a placeholder LI
          const placeholderLi = document.createElement('li');
          listStack[listStack.length - 1].appendChild(placeholderLi);
          liStack.push(placeholderLi);
        }

        // Create nested list
        const nestedList = document.createElement(item.parentListTag);
        liStack[liStack.length - 1].appendChild(nestedList);
        listStack.push(nestedList);
        currentDepth++;
      }

      // Clone the LI, but handle nested lists specially
      const liClone = this.cloneLiWithoutNestedList(item.element);
      listStack[listStack.length - 1].appendChild(liClone);

      // If this item has a nested list, prepare for nested items
      if (item.hasNestedList && item.nestedListTag) {
        liStack.push(liClone);
      } else {
        // Update liStack for current depth
        while (liStack.length > currentDepth) {
          liStack.pop();
        }
        if (currentDepth > 0) {
          // Keep parent LIs in stack
        }
      }
    }

    return rootList;
  }

  /**
   * Clone an LI element but remove any nested UL/OL
   */
  private cloneLiWithoutNestedList(li: HTMLElement): HTMLElement {
    const clone = li.cloneNode(false) as HTMLElement;

    for (const child of li.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        // Skip nested lists - they'll be reconstructed from flat items
        if (el.tagName === 'UL' || el.tagName === 'OL') {
          continue;
        }
      }
      clone.appendChild(child.cloneNode(true));
    }

    return clone;
  }
}
