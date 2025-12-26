import type { ElementHandler, SplitPoint } from './base.js';
import { BaseHandler } from './base.js';
import type { MeasuredBlock, ResolvedOptions } from '../types.js';

import { AtomicHandler } from './atomic.js';
import { ProseHandler } from './prose.js';
import { CodeHandler } from './code.js';
import { HeadingHandler } from './heading.js';
import { TableHandler } from './table.js';
import { ListHandler } from './list.js';
import { ContainerHandler } from './container.js';

export { ElementHandler, SplitPoint };
export { BaseHandler };
export { AtomicHandler, ProseHandler, CodeHandler, HeadingHandler, TableHandler, ListHandler, ContainerHandler };

/**
 * Registry of all element handlers
 * Order matters - more specific handlers should come first
 */
export class HandlerRegistry {
  private handlers: ElementHandler[] = [];
  private containerHandler: ContainerHandler;

  constructor() {
    // Register handlers in priority order
    this.handlers = [
      new AtomicHandler(),
      new HeadingHandler(),
      new ProseHandler(),
      new CodeHandler(),
      new TableHandler(),
      new ListHandler(),
    ];

    // Container is the fallback
    this.containerHandler = new ContainerHandler();
  }

  /**
   * Get the appropriate handler for an element
   */
  getHandler(el: HTMLElement): ElementHandler {
    for (const handler of this.handlers) {
      if (handler.canHandle(el)) {
        return handler;
      }
    }
    return this.containerHandler;
  }

  /**
   * Measure an element using the appropriate handler
   */
  measure(el: HTMLElement, options: ResolvedOptions): MeasuredBlock | null {
    // Skip empty text elements
    if (this.isEmpty(el)) return null;

    const handler = this.getHandler(el);

    // Special case for container which needs recursive measurement
    if (handler instanceof ContainerHandler) {
      return this.containerHandler.measureWithCallback(el, options, (child: HTMLElement) => this.measure(child, options));
    }

    return handler.measure(el, options);
  }

  /**
   * Find split point for a block
   */
  findSplitPoint(block: MeasuredBlock, available: number, options: ResolvedOptions): SplitPoint | null {
    const handler = this.getHandler(block.element);
    return handler.findSplitPoint(block, available, options);
  }

  /**
   * Render a block
   */
  render(block: MeasuredBlock, isPartial: boolean, clipTop?: number, clipHeight?: number, startLine?: number, endLine?: number): HTMLElement {
    const handler = this.getHandler(block.element);
    return handler.render(block, isPartial, clipTop, clipHeight, startLine, endLine);
  }

  private isEmpty(el: HTMLElement): boolean {
    const atomicTags = new Set(['IMG', 'HR', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME']);
    if (atomicTags.has(el.tagName)) return false;
    if (el.querySelector('img, video, canvas, svg, iframe')) return false;
    return el.textContent?.trim() === '';
  }
}

// Singleton instance
let registryInstance: HandlerRegistry | null = null;

export function getHandlerRegistry(): HandlerRegistry {
  if (!registryInstance) {
    registryInstance = new HandlerRegistry();
  }
  return registryInstance;
}
