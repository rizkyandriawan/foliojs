import type { ElementType, ResolvedOptions } from './types.js';
import { measureLineHeight, estimateLineCount, isEmpty, getCSSBreakBehavior } from './measure.js';

/**
 * Flattened item representing any content element
 */
export interface FlatItem {
  element: HTMLElement;
  depth: number;           // Hierarchy depth (h1=1, content under h1=11, nested=21, etc.)
  height: number;
  marginTop: number;
  marginBottom: number;
  type: ElementType;
  canSplit: boolean;
  forceBreakBefore: boolean;
  isHeading: boolean;
  headingLevel?: number;
  // For prose/line-based
  lineHeight?: number;
  lineCount?: number;
}

/**
 * Elements that are containers (traversed but not counted)
 */
const CONTAINER_ELEMENTS = new Set([
  'DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'NAV', 'HEADER', 'FOOTER',
  'BLOCKQUOTE', 'UL', 'OL', 'DL', 'FIGURE',
]);

/**
 * Atomic elements that should never be split
 */
const ATOMIC_ELEMENTS = new Set([
  'IMG', 'HR', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME',
]);

/**
 * Heading elements
 */
const HEADING_ELEMENTS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/**
 * Get element type for a content element
 */
function getElementType(el: HTMLElement): ElementType {
  const tag = el.tagName;

  if (ATOMIC_ELEMENTS.has(tag)) return 'atomic';
  if (HEADING_ELEMENTS.has(tag)) return 'heading-group';
  if (tag === 'P') return 'prose';
  if (tag === 'PRE' || tag === 'CODE') return 'line-based';
  if (tag === 'TABLE') return 'table';
  if (tag === 'LI') return 'semantic-sequence';
  if (tag === 'TR') return 'semantic-sequence';
  if (tag === 'DT' || tag === 'DD') return 'semantic-pair';
  if (tag === 'FIGCAPTION') return 'semantic-pair';

  // Check for math/diagram blocks
  const className = el.className;
  if (/\b(math|katex|mathjax|mermaid|diagram|chart)\b/i.test(className)) {
    return 'atomic';
  }

  return 'container';
}

/**
 * Check if element can be split
 */
function canElementSplit(el: HTMLElement, type: ElementType, options: ResolvedOptions): boolean {
  const { breakInside } = getCSSBreakBehavior(el);
  if (breakInside === 'avoid') return false;

  switch (type) {
    case 'atomic':
    case 'semantic-pair':
    case 'heading-group':
      return false;
    case 'prose':
      const lineCount = estimateLineCount(el);
      return lineCount >= options.orphanLines + options.widowLines;
    case 'line-based':
      return true;
    case 'semantic-sequence':
      return true;
    default:
      return false;
  }
}

/**
 * Flatten an entire document into a linear list with depth info
 *
 * Depth scheme:
 * - h1=1, h2=2, h3=3, h4=4, h5=5, h6=6
 * - Content under heading: heading_depth + 10
 * - Nested content: parent_depth + 10
 */
export function flattenDocument(
  container: HTMLElement,
  options: ResolvedOptions
): FlatItem[] {
  const items: FlatItem[] = [];
  let currentHeadingDepth = 0; // No heading yet = 0

  function traverse(el: HTMLElement, nestingLevel: number) {
    // Skip empty elements
    if (options.skipEmptyElements && isEmpty(el)) {
      return;
    }

    const tag = el.tagName;
    const type = getElementType(el);

    // Handle headings - they set a new heading depth
    if (HEADING_ELEMENTS.has(tag)) {
      const level = parseInt(tag[1]); // h1=1, h2=2, etc.
      currentHeadingDepth = level;

      const style = getComputedStyle(el);
      const { breakBefore } = getCSSBreakBehavior(el);

      items.push({
        element: el,
        depth: level,
        height: el.offsetHeight,
        marginTop: parseFloat(style.marginTop) || 0,
        marginBottom: parseFloat(style.marginBottom) || 0,
        type: 'heading-group',
        canSplit: false,
        forceBreakBefore: breakBefore || tag === 'H1',
        isHeading: true,
        headingLevel: level,
      });
      return;
    }

    // Handle containers - traverse children but don't count the container itself
    if (CONTAINER_ELEMENTS.has(tag) || type === 'container') {
      for (const child of el.children) {
        if (child instanceof HTMLElement) {
          traverse(child, nestingLevel + 1);
        }
      }
      return;
    }

    // Handle tables specially
    if (type === 'table') {
      // For now, treat table as atomic (TODO: handle table row splitting)
      const depth = currentHeadingDepth === 0 ? 10 : currentHeadingDepth + (nestingLevel * 10);
      const style = getComputedStyle(el);

      items.push({
        element: el,
        depth,
        height: el.offsetHeight,
        marginTop: parseFloat(style.marginTop) || 0,
        marginBottom: parseFloat(style.marginBottom) || 0,
        type: 'table',
        canSplit: false, // TODO: enable table splitting
        forceBreakBefore: false,
        isHeading: false,
      });
      return;
    }

    // Content element - calculate depth and add to list
    const depth = currentHeadingDepth === 0 ? 10 + (nestingLevel * 10) : currentHeadingDepth + (nestingLevel * 10);
    const style = getComputedStyle(el);
    const { breakBefore } = getCSSBreakBehavior(el);

    const item: FlatItem = {
      element: el,
      depth,
      height: el.offsetHeight,
      marginTop: parseFloat(style.marginTop) || 0,
      marginBottom: parseFloat(style.marginBottom) || 0,
      type,
      canSplit: canElementSplit(el, type, options),
      forceBreakBefore: breakBefore,
      isHeading: false,
    };

    // Add line info for prose/line-based
    if (type === 'prose' || type === 'line-based') {
      item.lineHeight = measureLineHeight(el);
      item.lineCount = estimateLineCount(el);
    }

    items.push(item);

    // For LI, traverse children for nested content but don't double-count
    // The LI itself is already added, now check for nested lists inside
    if (tag === 'LI') {
      for (const child of el.children) {
        if (child instanceof HTMLElement) {
          const childTag = child.tagName;
          // Only traverse nested lists, not other content (which is part of this LI)
          if (childTag === 'UL' || childTag === 'OL') {
            traverse(child, nestingLevel + 1);
          }
        }
      }
    }
  }

  // Start traversal
  for (const child of container.children) {
    if (child instanceof HTMLElement) {
      traverse(child, 1);
    }
  }

  return items;
}

/**
 * Find parent of an item (closest predecessor with lower depth)
 */
export function findParent(items: FlatItem[], index: number): number {
  const currentDepth = items[index].depth;
  for (let i = index - 1; i >= 0; i--) {
    if (items[i].depth < currentDepth) {
      return i;
    }
  }
  return -1; // No parent
}

/**
 * Find children of an item (successors until depth <= current)
 */
export function findChildren(items: FlatItem[], index: number): number[] {
  const currentDepth = items[index].depth;
  const children: number[] = [];

  for (let i = index + 1; i < items.length; i++) {
    if (items[i].depth <= currentDepth) {
      break;
    }
    children.push(i);
  }

  return children;
}

/**
 * Check if an item is a direct child of another
 */
export function isDirectChild(items: FlatItem[], parentIndex: number, childIndex: number): boolean {
  if (childIndex <= parentIndex) return false;

  const parentDepth = items[parentIndex].depth;
  const childDepth = items[childIndex].depth;

  // Direct child has depth = parent + 10
  if (childDepth !== parentDepth + 10) return false;

  // Check no intermediate items break the relationship
  for (let i = parentIndex + 1; i < childIndex; i++) {
    if (items[i].depth <= parentDepth) return false;
  }

  return true;
}
