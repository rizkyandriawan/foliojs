import { BaseHandler, SplitPoint } from './base.js';
import type { MeasuredBlock, ResolvedOptions } from '../types.js';

/**
 * Handler for prose elements (paragraphs) with orphan/widow rules
 */
export class ProseHandler extends BaseHandler {
  readonly type = 'prose' as const;

  canHandle(el: HTMLElement): boolean {
    return el.tagName === 'P';
  }

  measure(el: HTMLElement, options: ResolvedOptions): MeasuredBlock {
    const block = super.measure(el, options);

    // Check if paragraph contains images/media - these shouldn't be split
    if (this.containsMedia(el)) {
      block.canSplit = false;
      return block;
    }

    // Calculate line info
    block.lineHeight = this.measureLineHeight(el);
    block.lineCount = this.estimateLineCount(el, block.lineHeight);

    // Can split if enough lines for orphan + widow
    const minLines = options.orphanLines + options.widowLines;
    block.canSplit = block.lineCount >= minLines && this.getCSSBreakInside(el) !== 'avoid';

    return block;
  }

  private containsMedia(el: HTMLElement): boolean {
    const mediaElements = el.querySelectorAll('img, svg, video, canvas, iframe');
    return mediaElements.length > 0;
  }

  canSplit(block: MeasuredBlock, options: ResolvedOptions): boolean {
    if (!block.lineCount) return false;
    return block.lineCount >= options.orphanLines + options.widowLines;
  }

  findSplitPoint(block: MeasuredBlock, available: number, options: ResolvedOptions): SplitPoint | null {
    const { lineCount, lineHeight } = block;
    if (!lineCount || !lineHeight) return null;

    const minLines = options.orphanLines + options.widowLines;
    if (lineCount < minLines) return null;

    // If available space is less than minContentLines worth OR less than 60% of block height,
    // don't split - move whole block to avoid tiny fragments
    const minContentHeight = options.minContentLines * lineHeight;
    const minByRatio = block.height * 0.6;
    if (available < Math.max(minContentHeight, minByRatio)) {
      console.log(`[Prose] Skip split: available=${available} < max(${minContentHeight}, ${minByRatio})`);
      return null;
    }

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

  render(block: MeasuredBlock, isPartial: boolean, clipTop?: number, clipHeight?: number): HTMLElement {
    const clone = block.element.cloneNode(true) as HTMLElement;

    if (isPartial && clipTop !== undefined && clipHeight !== undefined) {
      clone.style.overflow = 'hidden';
      clone.style.height = `${clipHeight}px`;
      clone.style.marginTop = `-${clipTop}px`;

      const wrapper = document.createElement('div');
      wrapper.style.overflow = 'hidden';
      wrapper.style.height = `${clipHeight}px`;
      wrapper.appendChild(clone);
      return wrapper;
    }

    return clone;
  }

  private measureLineHeight(el: HTMLElement): number {
    const style = getComputedStyle(el);
    const lineHeight = style.lineHeight;

    if (lineHeight === 'normal') {
      return parseFloat(style.fontSize) * 1.2;
    }

    return parseFloat(lineHeight);
  }

  private estimateLineCount(el: HTMLElement, lineHeight: number): number {
    if (lineHeight <= 0) return 1;
    return Math.ceil(el.scrollHeight / lineHeight);
  }
}
