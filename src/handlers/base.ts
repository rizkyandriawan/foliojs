import type { MeasuredBlock, ResolvedOptions, ElementType } from '../types.js';

/**
 * Split point information
 */
export interface SplitPoint {
  type: 'line' | 'child';
  index: number;
  heightBefore: number;
  heightAfter: number;
}

/**
 * Base interface for element handlers
 */
export interface ElementHandler {
  /** Element type this handler processes */
  readonly type: ElementType;

  /** Check if this handler can process the element */
  canHandle(el: HTMLElement): boolean;

  /** Measure the element and its children */
  measure(el: HTMLElement, options: ResolvedOptions): MeasuredBlock;

  /** Check if the block can be split */
  canSplit(block: MeasuredBlock, options: ResolvedOptions): boolean;

  /** Find optimal split point given available space */
  findSplitPoint(block: MeasuredBlock, available: number, options: ResolvedOptions): SplitPoint | null;

  /** Render the block (or partial block) to DOM element */
  render(block: MeasuredBlock, isPartial: boolean, clipTop?: number, clipHeight?: number, startLine?: number, endLine?: number): HTMLElement;
}

/**
 * Base class with common functionality
 */
export abstract class BaseHandler implements ElementHandler {
  abstract readonly type: ElementType;

  abstract canHandle(el: HTMLElement): boolean;

  measure(el: HTMLElement, options: ResolvedOptions): MeasuredBlock {
    const style = getComputedStyle(el);

    return {
      element: el,
      type: this.type,
      height: el.offsetHeight,
      marginTop: parseFloat(style.marginTop) || 0,
      marginBottom: parseFloat(style.marginBottom) || 0,
      canSplit: this.canSplit({} as MeasuredBlock, options),
      forceBreakBefore: this.shouldForceBreakBefore(el),
      isHeading: false,
    };
  }

  canSplit(_block: MeasuredBlock, _options: ResolvedOptions): boolean {
    return false;
  }

  findSplitPoint(_block: MeasuredBlock, _available: number, _options: ResolvedOptions): SplitPoint | null {
    return null;
  }

  render(block: MeasuredBlock, _isPartial: boolean, _clipTop?: number, _clipHeight?: number, _startLine?: number, _endLine?: number): HTMLElement {
    return block.element.cloneNode(true) as HTMLElement;
  }

  protected shouldForceBreakBefore(el: HTMLElement): boolean {
    const style = getComputedStyle(el);
    return (
      style.breakBefore === 'page' ||
      style.breakBefore === 'always' ||
      el.hasAttribute('data-folio-break-before')
    );
  }

  protected getCSSBreakInside(el: HTMLElement): 'auto' | 'avoid' {
    const style = getComputedStyle(el);
    return (
      style.breakInside === 'avoid' ||
      el.hasAttribute('data-folio-keep-together')
    ) ? 'avoid' : 'auto';
  }
}
