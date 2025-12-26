import { BaseHandler } from './base.js';
import type { MeasuredBlock, ResolvedOptions } from '../types.js';

const ATOMIC_TAGS = new Set([
  'IMG', 'HR', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME',
]);

/**
 * Handler for atomic elements that should never be split
 * Includes: img, hr, svg, canvas, video, audio, iframe, math blocks, diagrams
 */
export class AtomicHandler extends BaseHandler {
  readonly type = 'atomic' as const;

  canHandle(el: HTMLElement): boolean {
    if (ATOMIC_TAGS.has(el.tagName)) return true;

    // Math blocks
    if (/\b(math|katex|mathjax)\b/i.test(el.className)) return true;

    // Diagram blocks
    if (/\b(mermaid|diagram|chart)\b/i.test(el.className)) return true;

    return false;
  }

  measure(el: HTMLElement, options: ResolvedOptions): MeasuredBlock {
    const block = super.measure(el, options);
    block.canSplit = false;
    return block;
  }

  canSplit(): boolean {
    return false;
  }
}
