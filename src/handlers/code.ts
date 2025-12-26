import { BaseHandler, SplitPoint } from './base.js';
import type { MeasuredBlock, ResolvedOptions } from '../types.js';

/**
 * Handler for code blocks (pre, code)
 * Splits by actual lines, not CSS clipping
 */
export class CodeHandler extends BaseHandler {
  readonly type = 'line-based' as const;

  // Small padding height for continuation indicators
  private readonly PADDING_HEIGHT = 8;

  canHandle(el: HTMLElement): boolean {
    return el.tagName === 'PRE' || (el.tagName === 'CODE' && el.parentElement?.tagName !== 'PRE');
  }

  measure(el: HTMLElement, options: ResolvedOptions): MeasuredBlock {
    const block = super.measure(el, options);

    // Get actual lines from text content
    const lines = this.getLines(el);
    block.lineCount = lines.length;
    block.lineHeight = this.measureLineHeight(el);

    // Code blocks can split if more than 1 line
    block.canSplit = lines.length > 1 && this.getCSSBreakInside(el) !== 'avoid';

    return block;
  }

  canSplit(block: MeasuredBlock, _options: ResolvedOptions): boolean {
    return (block.lineCount ?? 1) > 1;
  }

  findSplitPoint(block: MeasuredBlock, available: number, _options: ResolvedOptions): SplitPoint | null {
    const { lineCount, lineHeight } = block;
    if (!lineCount || !lineHeight || lineCount < 2) return null;

    // Account for padding at bottom of first part
    const availableForLines = available - this.PADDING_HEIGHT;
    const linesInAvailable = Math.floor(availableForLines / lineHeight);

    if (linesInAvailable < 1) return null;

    const linesRemaining = lineCount - linesInAvailable;
    if (linesRemaining < 1) return null;

    return {
      type: 'line',
      index: linesInAvailable,
      heightBefore: linesInAvailable * lineHeight + this.PADDING_HEIGHT,
      heightAfter: linesRemaining * lineHeight + this.PADDING_HEIGHT,
    };
  }

  render(block: MeasuredBlock, isPartial: boolean, _clipTop?: number, _clipHeight?: number, startLine?: number, endLine?: number): HTMLElement {
    const el = block.element;

    // Full render - just clone
    if (!isPartial || startLine === undefined) {
      return el.cloneNode(true) as HTMLElement;
    }

    // Partial render - extract specific lines
    const lines = this.getLines(el);
    const selectedLines = lines.slice(startLine, endLine);

    // Create new pre element with same attributes
    const clone = document.createElement(el.tagName) as HTMLElement;
    for (const attr of el.attributes) {
      clone.setAttribute(attr.name, attr.value);
    }

    // Check if there's a code element inside
    const codeEl = el.querySelector('code');

    if (codeEl) {
      const codeClone = document.createElement('code');
      for (const attr of codeEl.attributes) {
        codeClone.setAttribute(attr.name, attr.value);
      }
      codeClone.textContent = selectedLines.join('\n');
      clone.appendChild(codeClone);
    } else {
      clone.textContent = selectedLines.join('\n');
    }

    // Add padding indicator at top if this is a continuation
    if (startLine > 0) {
      const topPad = document.createElement('div');
      topPad.style.height = `${this.PADDING_HEIGHT}px`;
      topPad.style.borderTop = '1px dashed rgba(128,128,128,0.3)';
      topPad.style.marginBottom = '4px';

      const wrapper = document.createElement('div');
      wrapper.appendChild(topPad);
      wrapper.appendChild(clone);

      // Add bottom padding if not the last fragment
      if (endLine !== undefined && endLine < lines.length) {
        const bottomPad = document.createElement('div');
        bottomPad.style.height = `${this.PADDING_HEIGHT}px`;
        bottomPad.style.borderBottom = '1px dashed rgba(128,128,128,0.3)';
        bottomPad.style.marginTop = '4px';
        wrapper.appendChild(bottomPad);
      }

      return wrapper;
    }

    // First fragment - only add bottom padding if split
    if (endLine !== undefined && endLine < lines.length) {
      const wrapper = document.createElement('div');
      wrapper.appendChild(clone);

      const bottomPad = document.createElement('div');
      bottomPad.style.height = `${this.PADDING_HEIGHT}px`;
      bottomPad.style.borderBottom = '1px dashed rgba(128,128,128,0.3)';
      bottomPad.style.marginTop = '4px';
      wrapper.appendChild(bottomPad);

      return wrapper;
    }

    return clone;
  }

  private getLines(el: HTMLElement): string[] {
    const text = el.textContent || '';
    return text.split('\n');
  }

  private measureLineHeight(el: HTMLElement): number {
    const style = getComputedStyle(el);
    const lineHeight = style.lineHeight;

    if (lineHeight === 'normal') {
      return parseFloat(style.fontSize) * 1.2;
    }

    return parseFloat(lineHeight);
  }
}
