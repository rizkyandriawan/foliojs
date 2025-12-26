import { BaseHandler, SplitPoint } from './base.js';
import type { MeasuredBlock, ResolvedOptions } from '../types.js';

const BLOCK_ELEMENTS = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE',
  'FIGURE', 'FIGCAPTION', 'HR', 'DL', 'DT', 'DD',
  'SECTION', 'ARTICLE', 'ASIDE', 'NAV', 'HEADER', 'FOOTER',
]);

/**
 * Handler for container elements (div, blockquote, section, etc.)
 * Splits between children, not within children
 */
export class ContainerHandler extends BaseHandler {
  readonly type = 'container' as const;

  canHandle(el: HTMLElement): boolean {
    // Containers are the fallback - handled after more specific handlers
    const tag = el.tagName;
    return (
      tag === 'DIV' ||
      tag === 'BLOCKQUOTE' ||
      tag === 'SECTION' ||
      tag === 'ARTICLE' ||
      tag === 'ASIDE' ||
      tag === 'NAV' ||
      tag === 'HEADER' ||
      tag === 'FOOTER' ||
      // Admonitions
      /\b(note|warning|info|tip|caution|danger|admonition)\b/i.test(el.className)
    );
  }

  measure(el: HTMLElement, options: ResolvedOptions): MeasuredBlock {
    const block = super.measure(el, options);
    // Note: Children are measured separately via measureWithCallback
    block.canSplit = this.getCSSBreakInside(el) !== 'avoid';
    return block;
  }

  /**
   * Measure with recursive child measurement
   */
  measureWithCallback(el: HTMLElement, options: ResolvedOptions, measureChild: (el: HTMLElement) => MeasuredBlock | null): MeasuredBlock {
    const block = super.measure(el, options);

    // Measure children
    const childElements = this.getBlockChildren(el);
    if (childElements.length > 0) {
      block.children = childElements
        .map(child => measureChild(child))
        .filter((b): b is MeasuredBlock => b !== null);
    }

    // Can split if has multiple children
    block.canSplit = (block.children?.length ?? 0) > 1 && this.getCSSBreakInside(el) !== 'avoid';

    return block;
  }

  canSplit(block: MeasuredBlock, _options: ResolvedOptions): boolean {
    return (block.children?.length ?? 0) > 1;
  }

  findSplitPoint(block: MeasuredBlock, available: number, _options: ResolvedOptions): SplitPoint | null {
    const children = block.children;
    if (!children || children.length < 2) return null;

    let cumHeight = 0;
    let splitIndex = -1;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childHeight = child.height + child.marginTop + child.marginBottom;

      if (cumHeight + childHeight > available) {
        if (i > 0) {
          splitIndex = i;
        }
        break;
      }

      cumHeight += childHeight;
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

  render(block: MeasuredBlock, isPartial: boolean): HTMLElement {
    const sourceEl = block.element;

    // If this is a split container (fewer children than original)
    if (isPartial && block.children) {
      const originalChildCount = sourceEl.children.length;
      if (block.children.length < originalChildCount) {
        // Shallow clone the container
        const clone = sourceEl.cloneNode(false) as HTMLElement;

        // Only add the children from this fragment
        for (const childBlock of block.children) {
          const childClone = childBlock.element.cloneNode(true) as HTMLElement;
          clone.appendChild(childClone);
        }

        return clone;
      }
    }

    return sourceEl.cloneNode(true) as HTMLElement;
  }

  private getBlockChildren(el: HTMLElement): HTMLElement[] {
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
}
