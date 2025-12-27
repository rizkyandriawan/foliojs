/**
 * Paginate V2 - Fill until overflow approach
 *
 * Core idea:
 * - Add elements one by one to a page container
 * - When overflow detected, remove last and start new page
 * - For nested elements, track open ancestors and reopen on new page
 */

import type { ResolvedOptions } from './types.js';

interface PageResult {
  element: HTMLElement;
  pageNumber: number;
}

interface AncestorInfo {
  element: HTMLElement;
  // For tables, store thead to repeat on new pages
  thead?: HTMLElement;
}

interface PaginationState {
  pages: PageResult[];
  currentPage: HTMLElement;
  measureBox: HTMLElement;
  maxHeight: number;
  options: ResolvedOptions;
  // Stack of open ancestor elements (for nested structures)
  ancestorStack: AncestorInfo[];
}

/**
 * Main pagination function
 */
export function paginateV2(
  sourceContainer: HTMLElement,
  options: ResolvedOptions
): PageResult[] {
  // Use sourceContainer directly as measureBox - it's already set up with proper CSS inheritance
  // Just ensure it has the right styles for measurement
  const measureBox = sourceContainer;
  measureBox.style.width = `${options.contentWidth}px`;
  measureBox.style.overflow = 'visible';

  // Clear existing content and prepare for pagination
  const originalChildren = Array.from(sourceContainer.children) as HTMLElement[];
  sourceContainer.innerHTML = '';

  const state: PaginationState = {
    pages: [],
    currentPage: createPageDiv(),
    measureBox,
    maxHeight: options.contentHeight,
    options,
    ancestorStack: []
  };

  // Attach current page to measure box
  measureBox.appendChild(state.currentPage);

  // Process all original children
  for (const child of originalChildren) {
    processElement(child, state);
  }

  // Save final page if it has content
  if (state.currentPage.children.length > 0 || state.currentPage.textContent?.trim()) {
    finalizePage(state);
  }

  // Cleanup - remove the page div we added for measurement
  measureBox.innerHTML = '';

  return state.pages;
}

/**
 * Process a single element - add to current page or split if needed
 */
function processElement(element: HTMLElement, state: PaginationState): void {
  const target = getCurrentTarget(state);
  const tag = element.tagName.toLowerCase();

  // For lists: don't try to add whole thing, go straight to split mode
  // This avoids measuring the full list and only measures after each <li>
  if (tag === 'ul' || tag === 'ol') {
    const didSplit = trySplitContainer(element, state);
    if (didSplit) return;
    // If split failed (e.g., no children fit), move to new page
    startNewPage(state);
    // Try again on fresh page
    const retryResult = trySplitContainer(element, state);
    if (!retryResult) {
      // Still can't fit, just add it anyway
      const newTarget = getCurrentTarget(state);
      newTarget.appendChild(element.cloneNode(true) as HTMLElement);
    }
    return;
  }

  // Clone and try to add
  const clone = element.cloneNode(true) as HTMLElement;
  target.appendChild(clone);

  // Check if it fits
  if (state.measureBox.scrollHeight <= state.maxHeight) {
    // Fits! We're done
    return;
  }

  // Overflow! Remove the clone
  clone.remove();

  if (tag === 'table') {
    const didSplit = trySplitTable(element as HTMLTableElement, state);
    if (didSplit) return;
  } else if (isSplittable(element)) {
    const didSplit = trySplitContainer(element, state);
    if (didSplit) return;
  }

  // Can't split - start new page and retry
  startNewPage(state);

  // Retry adding the element
  const newTarget = getCurrentTarget(state);
  const newClone = element.cloneNode(true) as HTMLElement;
  newTarget.appendChild(newClone);

  // If it still doesn't fit on empty page, it's oversized - keep anyway
  if (state.measureBox.scrollHeight > state.maxHeight) {
    console.warn('Oversized element, keeping on page anyway:', element.tagName);
  }
}

/**
 * Try to split a table across pages
 * - Keeps thead on each page
 * - Splits between tbody rows
 */
function trySplitTable(table: HTMLTableElement, state: PaginationState): boolean {
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody') || table;
  const rows = Array.from(tbody.querySelectorAll(':scope > tr')) as HTMLTableRowElement[];

  if (rows.length < state.options.minRowsForSplit * 2) {
    // Not enough rows to split
    return false;
  }

  const target = getCurrentTarget(state);

  // Create table clone without rows
  const tableClone = table.cloneNode(false) as HTMLTableElement;
  target.appendChild(tableClone);

  // Add thead if exists
  let theadClone: HTMLElement | undefined;
  if (thead) {
    theadClone = thead.cloneNode(true) as HTMLElement;
    tableClone.appendChild(theadClone);
  }

  // Create tbody
  const tbodyClone = document.createElement('tbody');
  tableClone.appendChild(tbodyClone);

  // Push table to ancestor stack with thead info
  state.ancestorStack.push({
    element: tableClone,
    thead: thead ? thead.cloneNode(true) as HTMLElement : undefined
  });

  // Also push tbody to stack
  state.ancestorStack.push({ element: tbodyClone });

  let fittedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowClone = row.cloneNode(true) as HTMLTableRowElement;
    tbodyClone.appendChild(rowClone);

    if (state.measureBox.scrollHeight > state.maxHeight) {
      // This row caused overflow
      rowClone.remove();

      // Check minimum rows constraint
      if (fittedCount < state.options.minRowsForSplit) {
        // Not enough rows fit, can't split here
        tableClone.remove();
        state.ancestorStack.pop(); // tbody
        state.ancestorStack.pop(); // table
        return false;
      }

      // Check if remaining rows meet minimum
      const remainingCount = rows.length - i;
      if (remainingCount < state.options.minRowsForSplit) {
        // Would leave too few rows on next page
        // Remove some rows from current page to balance
        const rowsToMove = state.options.minRowsForSplit - remainingCount;
        for (let j = 0; j < rowsToMove && tbodyClone.lastChild; j++) {
          tbodyClone.lastChild.remove();
          fittedCount--;
        }
        // Adjust index
        const newStartIndex = i - rowsToMove;

        // Start new page for remaining rows
        state.ancestorStack.pop(); // tbody
        state.ancestorStack.pop(); // table
        startNewPage(state);

        // Process remaining rows
        processRemainingRows(table, rows.slice(newStartIndex), thead, state);
        return true;
      }

      // Start new page for remaining rows
      state.ancestorStack.pop(); // tbody
      state.ancestorStack.pop(); // table
      startNewPage(state);

      // Process remaining rows
      processRemainingRows(table, rows.slice(i), thead, state);
      return true;
    }

    fittedCount++;
  }

  // All rows fit
  state.ancestorStack.pop(); // tbody
  state.ancestorStack.pop(); // table
  return true;
}

/**
 * Process remaining table rows on new page(s)
 */
function processRemainingRows(
  originalTable: HTMLTableElement,
  rows: HTMLTableRowElement[],
  thead: HTMLElement | null,
  state: PaginationState
): void {
  if (rows.length === 0) return;

  const target = getCurrentTarget(state);

  // Create new table
  const tableClone = originalTable.cloneNode(false) as HTMLTableElement;
  target.appendChild(tableClone);

  // Add thead (repeated)
  if (thead) {
    tableClone.appendChild(thead.cloneNode(true));
  }

  // Create tbody
  const tbodyClone = document.createElement('tbody');
  tableClone.appendChild(tbodyClone);

  // Push to stack
  state.ancestorStack.push({
    element: tableClone,
    thead: thead ? thead.cloneNode(true) as HTMLElement : undefined
  });
  state.ancestorStack.push({ element: tbodyClone });

  let fittedCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowClone = row.cloneNode(true) as HTMLTableRowElement;
    tbodyClone.appendChild(rowClone);

    if (state.measureBox.scrollHeight > state.maxHeight) {
      // Overflow again
      rowClone.remove();

      if (fittedCount < state.options.minRowsForSplit) {
        // This shouldn't happen on a fresh page, but handle it
        console.warn('Table row too large for page');
        tbodyClone.appendChild(rowClone); // Keep it anyway
        fittedCount++;
        continue;
      }

      // Start another new page
      state.ancestorStack.pop(); // tbody
      state.ancestorStack.pop(); // table
      startNewPage(state);

      // Recursively process remaining
      processRemainingRows(originalTable, rows.slice(i), thead, state);
      return;
    }

    fittedCount++;
  }

  // All remaining rows fit
  state.ancestorStack.pop(); // tbody
  state.ancestorStack.pop(); // table
}

/**
 * Try to split a generic container across pages
 */
function trySplitContainer(element: HTMLElement, state: PaginationState): boolean {
  const children = Array.from(element.children) as HTMLElement[];
  if (children.length === 0) return false;

  const tag = element.tagName.toLowerCase();
  const isList = tag === 'ul' || tag === 'ol';
  const minItemHeight = 70; // Minimum height for a single item to be left alone

  const target = getCurrentTarget(state);

  // Create empty container
  const container = element.cloneNode(false) as HTMLElement;
  target.appendChild(container);

  // Push to ancestor stack
  state.ancestorStack.push({ element: container });

  let fittedCount = 0;
  const fittedElements: HTMLElement[] = []; // Track fitted elements for height check

  for (const child of children) {
    const childTag = child.tagName.toLowerCase();

    // For nested lists: don't clone whole thing, recurse
    if (childTag === 'ul' || childTag === 'ol') {
      // Recursively process nested list
      const nestedResult = trySplitContainer(child, state);
      if (!nestedResult) {
        // Nested list couldn't fit at all
        if (fittedCount === 0) {
          container.remove();
          state.ancestorStack.pop();
          return false;
        }
        // Start new page and continue
        state.ancestorStack.pop();
        startNewPage(state);
        const remainingFromCurrent = children.slice(children.indexOf(child));
        for (const remaining of remainingFromCurrent) {
          processElement(remaining, state);
        }
        return true;
      }
      fittedCount++;
      continue;
    }

    // For <li> with nested list: add content first, then recurse for nested list
    const nestedList = child.querySelector(':scope > ul, :scope > ol');
    let childClone: HTMLElement;

    if (nestedList && childTag === 'li') {
      // Clone li without the nested list
      childClone = child.cloneNode(false) as HTMLElement;
      // Add all children except the nested list
      for (const liChild of Array.from(child.childNodes)) {
        if (liChild !== nestedList) {
          childClone.appendChild(liChild.cloneNode(true));
        }
      }
      container.appendChild(childClone);
      fittedElements.push(childClone);

      // Check overflow after adding li content (before nested list)
      if (state.measureBox.scrollHeight > state.maxHeight) {
        childClone.remove();
        fittedElements.pop();
        // Handle overflow same as below
        if (fittedCount === 0) {
          container.remove();
          state.ancestorStack.pop();
          return false;
        }
        state.ancestorStack.pop();
        startNewPage(state);
        const remainingFromCurrent = children.slice(children.indexOf(child));
        for (const remaining of remainingFromCurrent) {
          processElement(remaining, state);
        }
        return true;
      }

      fittedCount++;

      // Now process the nested list inside this li
      state.ancestorStack.push({ element: childClone });
      const nestedResult = trySplitContainer(nestedList as HTMLElement, state);
      state.ancestorStack.pop();

      if (!nestedResult) {
        // Nested list couldn't start - will be handled on next page via remaining processing
      }
      continue;
    }

    // Regular element: clone whole thing
    childClone = child.cloneNode(true) as HTMLElement;
    container.appendChild(childClone);

    if (state.measureBox.scrollHeight > state.maxHeight) {
      // This child caused overflow
      childClone.remove();

      // For lists: check if we'd leave too few items
      if (isList && fittedCount > 0) {
        // Rule: either 2+ items, or 1 item with height > minItemHeight
        if (fittedCount === 1) {
          const firstFittedHeight = fittedElements[0]?.offsetHeight || 0;
          if (firstFittedHeight < minItemHeight) {
            // Single small item - don't split, move whole list
            container.remove();
            state.ancestorStack.pop();
            return false;
          }
        }
      }

      // If we haven't fitted anything and this is first child, try to split it
      if (fittedCount === 0) {
        const childTag = child.tagName.toLowerCase();
        let didSplit = false;

        if (childTag === 'table') {
          didSplit = trySplitTable(child as HTMLTableElement, state);
        } else if (isSplittable(child)) {
          didSplit = trySplitContainer(child, state);
        }

        if (didSplit) {
          fittedCount++;
          // Continue processing remaining children
          state.ancestorStack.pop();

          const remainingChildren = children.slice(children.indexOf(child) + 1);
          for (const remaining of remainingChildren) {
            processElement(remaining, state);
          }
          return true;
        }
      }

      // Can't fit this child
      if (fittedCount === 0) {
        // Nothing fits, remove container and fail
        container.remove();
        state.ancestorStack.pop();
        return false;
      }

      // Some children fit - start new page for rest
      state.ancestorStack.pop();
      startNewPage(state);

      // Process remaining children (including current)
      const remainingFromCurrent = children.slice(children.indexOf(child));
      for (const remaining of remainingFromCurrent) {
        processElement(remaining, state);
      }
      return true;
    }

    fittedElements.push(childClone);
    fittedCount++;
  }

  // All children fit
  state.ancestorStack.pop();
  return true;
}

/**
 * Start a new page
 */
function startNewPage(state: PaginationState): void {
  // Before finalizing, check for trailing headings and move them to next page
  const trailingHeadings = popTrailingHeadings(state.currentPage);

  // Save current page
  finalizePage(state);

  // Create new page
  state.currentPage = createPageDiv();
  state.measureBox.innerHTML = '';
  state.measureBox.appendChild(state.currentPage);

  // Reopen ancestors
  reopenAncestors(state);

  // Add trailing headings to new page
  const target = getCurrentTarget(state);
  for (const heading of trailingHeadings) {
    target.appendChild(heading);
  }
}

/**
 * Remove trailing headings from a page and return them
 */
function popTrailingHeadings(page: HTMLElement): HTMLElement[] {
  const headings: HTMLElement[] = [];

  while (page.lastElementChild) {
    const last = page.lastElementChild as HTMLElement;
    const tag = last.tagName.toLowerCase();

    if (tag.match(/^h[1-6]$/)) {
      headings.unshift(last); // Add to front to maintain order
      last.remove();
    } else {
      break;
    }
  }

  return headings;
}

/**
 * Finalize and save current page
 */
function finalizePage(state: PaginationState): void {
  state.pages.push({
    element: state.currentPage.cloneNode(true) as HTMLElement,
    pageNumber: state.pages.length + 1
  });
}

/**
 * Get current target element (innermost open ancestor or page)
 */
function getCurrentTarget(state: PaginationState): HTMLElement {
  if (state.ancestorStack.length > 0) {
    return state.ancestorStack[state.ancestorStack.length - 1].element;
  }
  return state.currentPage;
}

/**
 * Reopen ancestor containers on new page
 */
function reopenAncestors(state: PaginationState): void {
  const oldStack = state.ancestorStack;
  state.ancestorStack = [];

  let target = state.currentPage;

  for (const ancestor of oldStack) {
    // Clone without children
    const reopened = ancestor.element.cloneNode(false) as HTMLElement;
    target.appendChild(reopened);

    // For tables, re-add thead
    if (ancestor.thead && reopened.tagName === 'TABLE') {
      reopened.appendChild(ancestor.thead.cloneNode(true));
    }

    state.ancestorStack.push({
      element: reopened,
      thead: ancestor.thead
    });
    target = reopened;
  }
}

/**
 * Check if element can be split (generic containers)
 */
function isSplittable(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  const splittableTags = ['ul', 'ol', 'div', 'blockquote', 'section', 'article', 'dl', 'li'];
  return splittableTags.includes(tag) && el.children.length > 1;
}

/**
 * Create page content div
 */
function createPageDiv(): HTMLElement {
  const div = document.createElement('div');
  div.className = 'folio-page-content';
  return div;
}

// Export for testing
export { PaginationState, PageResult };
