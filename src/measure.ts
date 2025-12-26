import type { MeasuredBlock, ElementType, ResolvedOptions } from './types.js';

/**
 * Block-level elements that we care about
 */
const BLOCK_ELEMENTS = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE',
  'FIGURE', 'FIGCAPTION', 'HR', 'DL', 'DT', 'DD',
  'SECTION', 'ARTICLE', 'ASIDE', 'NAV', 'HEADER', 'FOOTER',
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
 * Check if element is empty
 */
export function isEmpty(el: HTMLElement): boolean {
  if (ATOMIC_ELEMENTS.has(el.tagName)) return false;
  if (el.querySelector('img, video, canvas, svg, iframe')) return false;
  return el.textContent?.trim() === '';
}

/**
 * Check if element has CSS that forces break behavior
 */
export function getCSSBreakBehavior(el: HTMLElement): {
  breakBefore: boolean;
  breakAfter: boolean;
  breakInside: 'auto' | 'avoid';
} {
  const style = getComputedStyle(el);

  const breakBefore =
    style.breakBefore === 'page' ||
    style.breakBefore === 'always' ||
    el.hasAttribute('data-folio-break-before');

  const breakAfter =
    style.breakAfter === 'page' ||
    style.breakAfter === 'always' ||
    el.hasAttribute('data-folio-break-after');

  const breakInside: 'auto' | 'avoid' =
    style.breakInside === 'avoid' ||
    el.hasAttribute('data-folio-keep-together')
      ? 'avoid'
      : 'auto';

  return { breakBefore, breakAfter, breakInside };
}

/**
 * Determine element type for pagination heuristics
 */
export function getElementType(el: HTMLElement): ElementType {
  const tag = el.tagName;

  // Atomic elements
  if (ATOMIC_ELEMENTS.has(tag)) return 'atomic';

  // Headings
  if (HEADING_ELEMENTS.has(tag)) return 'heading-group';

  // Prose
  if (tag === 'P') return 'prose';

  // Line-based
  if (tag === 'PRE' || tag === 'CODE') return 'line-based';

  // Semantic pairs
  if (tag === 'FIGURE') return 'semantic-pair';
  if (tag === 'DT' || tag === 'DD') return 'semantic-pair';

  // Semantic sequences
  if (tag === 'LI') return 'semantic-sequence';
  if (tag === 'TR') return 'semantic-sequence';

  // Check for admonition (common class patterns)
  const className = el.className;
  if (/\b(note|warning|info|tip|caution|danger|admonition)\b/i.test(className)) {
    return 'container';
  }

  // Check for math blocks
  if (/\b(math|katex|mathjax)\b/i.test(className)) {
    return 'atomic';
  }

  // Check for diagram blocks
  if (/\b(mermaid|diagram|chart)\b/i.test(className)) {
    return 'atomic';
  }

  // Default: container (blockquote, div, section, etc.)
  return 'container';
}

/**
 * Measure line height of an element
 */
export function measureLineHeight(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const lineHeight = style.lineHeight;

  if (lineHeight === 'normal') {
    // Approximate: 1.2 * font-size
    return parseFloat(style.fontSize) * 1.2;
  }

  return parseFloat(lineHeight);
}

/**
 * Estimate line count for text-based elements
 */
export function estimateLineCount(el: HTMLElement): number {
  const lineHeight = measureLineHeight(el);
  if (lineHeight <= 0) return 1;

  // Use scrollHeight for more accurate measurement
  return Math.ceil(el.scrollHeight / lineHeight);
}

/**
 * Check if element can be split based on its type and constraints
 */
export function canElementSplit(
  el: HTMLElement,
  type: ElementType,
  options: ResolvedOptions
): boolean {
  // CSS override
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
      return true; // Can always split between lines

    case 'semantic-sequence':
      return true; // Can split, but with min items constraint

    case 'container':
      // Can split if has multiple children
      const children = getBlockChildren(el);
      return children.length > 1;

    default:
      return false;
  }
}

/**
 * Get block-level children of an element
 */
export function getBlockChildren(el: HTMLElement): HTMLElement[] {
  const children: HTMLElement[] = [];

  for (const child of el.children) {
    if (child instanceof HTMLElement) {
      const display = getComputedStyle(child).display;
      if (display !== 'inline' && display !== 'inline-block') {
        children.push(child);
      } else if (BLOCK_ELEMENTS.has(child.tagName)) {
        children.push(child);
      }
    }
  }

  return children;
}

/**
 * Measure a single element and its children recursively
 */
export function measureElement(
  el: HTMLElement,
  options: ResolvedOptions
): MeasuredBlock | null {
  // Skip empty elements
  if (options.skipEmptyElements && isEmpty(el)) {
    return null;
  }

  const type = getElementType(el);
  const style = getComputedStyle(el);
  const { breakBefore } = getCSSBreakBehavior(el);

  const block: MeasuredBlock = {
    element: el,
    type,
    height: el.offsetHeight,
    marginTop: parseFloat(style.marginTop) || 0,
    marginBottom: parseFloat(style.marginBottom) || 0,
    canSplit: canElementSplit(el, type, options),
    forceBreakBefore: breakBefore || el.tagName === 'H1',
    isHeading: HEADING_ELEMENTS.has(el.tagName),
    headingLevel: HEADING_ELEMENTS.has(el.tagName)
      ? parseInt(el.tagName[1])
      : undefined,
  };

  // Add line info for prose/line-based
  if (type === 'prose' || type === 'line-based') {
    block.lineHeight = measureLineHeight(el);
    block.lineCount = estimateLineCount(el);
  }

  // Measure children for containers
  if (type === 'container' || type === 'semantic-sequence') {
    const childElements = getBlockChildren(el);
    if (childElements.length > 0) {
      block.children = childElements
        .map(child => measureElement(child, options))
        .filter((b): b is MeasuredBlock => b !== null);
    }
  }

  return block;
}

/**
 * Measure all blocks in a container
 */
export function measureBlocks(
  container: HTMLElement,
  options: ResolvedOptions
): MeasuredBlock[] {
  const children = getBlockChildren(container);
  const blocks: MeasuredBlock[] = [];

  for (const child of children) {
    const measured = measureElement(child, options);
    if (measured) {
      blocks.push(measured);
    }
  }

  return blocks;
}

/**
 * Group consecutive headings together
 */
export function groupConsecutiveHeadings(
  blocks: MeasuredBlock[]
): MeasuredBlock[] {
  const result: MeasuredBlock[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.isHeading) {
      // Collect consecutive headings
      const headingGroup: MeasuredBlock[] = [block];
      let j = i + 1;

      while (j < blocks.length && blocks[j].isHeading) {
        headingGroup.push(blocks[j]);
        j++;
      }

      if (headingGroup.length > 1) {
        // Create a virtual group block
        const totalHeight = headingGroup.reduce(
          (sum, h) => sum + h.height + h.marginBottom,
          0
        );

        const groupBlock: MeasuredBlock = {
          element: block.element, // First heading as reference
          type: 'heading-group',
          height: totalHeight,
          marginTop: block.marginTop,
          marginBottom: headingGroup[headingGroup.length - 1].marginBottom,
          canSplit: false,
          forceBreakBefore: block.forceBreakBefore,
          isHeading: true,
          headingLevel: block.headingLevel,
          children: headingGroup,
        };

        result.push(groupBlock);
        i = j;
      } else {
        result.push(block);
        i++;
      }
    } else {
      result.push(block);
      i++;
    }
  }

  return result;
}
