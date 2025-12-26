import { BaseHandler } from './base.js';
import type { MeasuredBlock, ResolvedOptions } from '../types.js';

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

/**
 * Handler for headings
 * - Never split
 * - H1 forces page break
 * - Must have minContentLines after
 */
export class HeadingHandler extends BaseHandler {
  readonly type = 'heading-group' as const;

  canHandle(el: HTMLElement): boolean {
    return HEADING_TAGS.has(el.tagName);
  }

  measure(el: HTMLElement, options: ResolvedOptions): MeasuredBlock {
    const block = super.measure(el, options);

    block.isHeading = true;
    block.headingLevel = parseInt(el.tagName[1]);
    block.canSplit = false;

    // H1 forces page break
    if (el.tagName === 'H1') {
      block.forceBreakBefore = true;
    }

    return block;
  }

  canSplit(): boolean {
    return false;
  }

  /**
   * Check if heading can fit with minimum content after it
   */
  checkMinContent(block: MeasuredBlock, nextBlock: MeasuredBlock | undefined, remaining: number, options: ResolvedOptions): boolean {
    const lineHeight = nextBlock?.lineHeight ?? 20;
    const minContent = options.minContentLines * lineHeight;
    const needed = block.height + block.marginTop + minContent;
    return needed <= remaining;
  }
}
