import type { PaginateOptions, PageSizePreset, Orientation, Page, PageFragment, ResolvedOptions } from './types.js';
import { PAGE_SIZES } from './types.js';
import { paginate, resolveOptions } from './paginate.js';
import { paginateV2 } from './paginate-v2.js';
import { getHandlerRegistry } from './handlers/index.js';

/**
 * <folio-pages> Web Component
 *
 * Usage:
 * <folio-pages page-size="A4" orientation="portrait">
 *   <h1>My Document</h1>
 *   <p>Content here...</p>
 * </folio-pages>
 */
export class FolioElement extends HTMLElement {
  static observedAttributes = [
    'page-size',
    'page-height',
    'page-width',
    'orientation',
    'padding',
    'orphan-lines',
    'widow-lines',
    'min-content-lines',
    'repeat-table-header',
    'enable-line-wrap-markers',
    'algorithm',
  ];

  private originalContent: DocumentFragment | null = null;
  private pagesContainer: HTMLDivElement | null = null;
  private isPaginating = false;
  private contentObserver: MutationObserver | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
  }

  connectedCallback() {
    // Create pages container first
    this.pagesContainer = document.createElement('div');
    this.pagesContainer.className = 'folio-pages';

    // Check if we have initial content
    if (this.childNodes.length > 0) {
      // Store original content
      this.originalContent = document.createDocumentFragment();
      while (this.firstChild) {
        this.originalContent.appendChild(this.firstChild);
      }
      this.appendChild(this.pagesContainer);
      this.injectStyles();
      this.doPaginate();
    } else {
      // No content yet - set up observer for React/dynamic content
      this.appendChild(this.pagesContainer);
      this.injectStyles();
      this.setupContentObserver();
    }
  }

  disconnectedCallback() {
    this.originalContent = null;
    this.pagesContainer = null;
    if (this.contentObserver) {
      this.contentObserver.disconnect();
      this.contentObserver = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Set up MutationObserver to detect content added by React/frameworks
   */
  private setupContentObserver() {
    this.contentObserver = new MutationObserver((mutations) => {
      // Ignore mutations if we're paginating
      if (this.isPaginating) return;

      // Check if real content was added (not our internal elements)
      const hasNewContent = mutations.some(m =>
        Array.from(m.addedNodes).some(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false;
          const el = node as HTMLElement;
          // Skip our internal elements
          if (el === this.pagesContainer) return false;
          if (el.classList?.contains('folio-measure')) return false;
          if (el.classList?.contains('folio-pages')) return false;
          if (el.classList?.contains('folio-page')) return false;
          return true;
        })
      );

      if (hasNewContent) {
        // Debounce to batch multiple mutations
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.captureAndPaginate();
        }, 50); // Increased debounce for frameworks
      }
    });

    this.contentObserver.observe(this, { childList: true });
  }

  /**
   * Capture current content and paginate
   */
  private captureAndPaginate() {
    if (this.isPaginating) return;

    // Capture content (excluding our internal elements)
    this.originalContent = document.createDocumentFragment();
    const children = Array.from(this.childNodes);
    for (const child of children) {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        // Keep text nodes etc
        if (child.textContent?.trim()) {
          this.originalContent.appendChild(child.cloneNode(true));
        }
        continue;
      }
      const el = child as HTMLElement;
      // Skip internal elements
      if (el === this.pagesContainer) continue;
      if (el.classList?.contains('folio-measure')) continue;
      if (el.classList?.contains('folio-pages')) continue;
      // Move content to originalContent
      this.originalContent.appendChild(child);
    }

    if (this.originalContent.childNodes.length > 0) {
      this.doPaginate();
    }
  }

  attributeChangedCallback() {
    if (this.isConnected && !this.isPaginating && this.originalContent) {
      this.doPaginate();
    }
  }

  /**
   * Get options from attributes
   */
  private getOptions(): PaginateOptions {
    const options: PaginateOptions = {};

    const pageSize = this.getAttribute('page-size');
    if (pageSize && pageSize in PAGE_SIZES) {
      options.pageSize = pageSize as PageSizePreset;
    }

    const pageHeight = this.getAttribute('page-height');
    if (pageHeight) options.pageHeight = parseInt(pageHeight);

    const pageWidth = this.getAttribute('page-width');
    if (pageWidth) options.pageWidth = parseInt(pageWidth);

    const orientation = this.getAttribute('orientation');
    if (orientation === 'portrait' || orientation === 'landscape') {
      options.orientation = orientation as Orientation;
    }

    const padding = this.getAttribute('padding');
    if (padding) options.padding = parseInt(padding);

    const orphanLines = this.getAttribute('orphan-lines');
    if (orphanLines) options.orphanLines = parseInt(orphanLines);

    const widowLines = this.getAttribute('widow-lines');
    if (widowLines) options.widowLines = parseInt(widowLines);

    const minContentLines = this.getAttribute('min-content-lines');
    if (minContentLines) options.minContentLines = parseInt(minContentLines);

    const repeatTableHeader = this.getAttribute('repeat-table-header');
    if (repeatTableHeader !== null) {
      options.repeatTableHeader = repeatTableHeader !== 'false';
    }

    const enableLineWrapMarkers = this.getAttribute('enable-line-wrap-markers');
    if (enableLineWrapMarkers !== null) {
      options.enableLineWrapMarkers = enableLineWrapMarkers !== 'false';
    }

    return options;
  }

  /**
   * Perform pagination
   */
  private async doPaginate() {
    if (!this.originalContent || !this.pagesContainer || this.isPaginating) {
      return;
    }

    // Check if we have actual content
    if (this.originalContent.childNodes.length === 0) {
      return;
    }

    this.isPaginating = true;

    // Pause observer during pagination
    if (this.contentObserver) {
      this.contentObserver.disconnect();
    }

    try {
      // Create a hidden measurement container
      const measureContainer = document.createElement('div');
      measureContainer.className = 'folio-measure';

      const options = this.getOptions();
      const pageWidth = options.pageWidth || PAGE_SIZES.A4.width;
      measureContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        visibility: hidden;
        pointer-events: none;
        width: ${pageWidth}px;
      `;

      // Clone content into measurement container
      const contentClone = this.originalContent.cloneNode(true);
      measureContainer.appendChild(contentClone);

      // Append to 'this' so it inherits CSS selectors like "folio-pages h1"
      this.appendChild(measureContainer);

      // Wait for styles to apply
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Check which algorithm to use (default to v2)
      const algorithm = this.getAttribute('algorithm') || 'v2';

      if (algorithm === 'v2') {
        // Use V2 algorithm (fill until overflow)
        const resolved = resolveOptions(options);
        const v2Pages = paginateV2(measureContainer, resolved);

        // Clean up measurement container
        if (measureContainer.parentNode) {
          measureContainer.parentNode.removeChild(measureContainer);
        }

        // Render V2 pages
        this.renderPagesV2(v2Pages, resolved);

        // Dispatch event
        this.dispatchEvent(new CustomEvent('paginated', {
          detail: {
            totalPages: v2Pages.length,
            options: resolved,
          },
        }));
      } else {
        // Use V1 algorithm (pre-measure)
        const result = await paginate(measureContainer, options);

        // Clean up measurement container
        if (measureContainer.parentNode) {
          measureContainer.parentNode.removeChild(measureContainer);
        }

        // Render pages
        this.renderPages(result.pages, result.options);

        // Dispatch event
        this.dispatchEvent(new CustomEvent('paginated', {
          detail: {
            totalPages: result.totalPages,
            pages: result.pages,
            options: result.options,
          },
        }));
      }
    } catch (error) {
      console.error('Folio pagination error:', error);
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
    } finally {
      this.isPaginating = false;

      // Re-enable observer
      if (this.contentObserver) {
        this.contentObserver.observe(this, { childList: true });
      }
    }
  }

  /**
   * Render paginated pages
   */
  private renderPages(pages: Page[], options: { pageWidth: number; pageHeight: number; padding: { top: number; right: number; bottom: number; left: number } }) {
    if (!this.pagesContainer || !this.originalContent) return;

    this.pagesContainer.innerHTML = '';

    // Clone the original content for manipulation
    const sourceContent = this.originalContent.cloneNode(true) as DocumentFragment;
    const sourceContainer = document.createElement('div');
    sourceContainer.appendChild(sourceContent);

    pages.forEach((page, pageIndex) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'folio-page';
      pageEl.setAttribute('data-page', String(pageIndex + 1));
      pageEl.style.cssText = `
        width: ${options.pageWidth}px;
        height: ${options.pageHeight}px;
        padding: ${options.padding.top}px ${options.padding.right}px ${options.padding.bottom}px ${options.padding.left}px;
        box-sizing: border-box;
        background: white;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        overflow: hidden;
        position: relative;
      `;

      const contentEl = document.createElement('div');
      contentEl.className = 'folio-page-content';

      page.fragments.forEach((fragment) => {
        const el = this.renderFragment(fragment, sourceContainer);
        if (el) {
          contentEl.appendChild(el);
        }
      });

      pageEl.appendChild(contentEl);
      this.pagesContainer!.appendChild(pageEl);
    });
  }

  /**
   * Render a single fragment using handler registry
   */
  private renderFragment(fragment: PageFragment, _sourceContainer: HTMLElement): HTMLElement | null {
    const registry = getHandlerRegistry();
    return registry.render(
      fragment.block,
      fragment.isPartial,
      fragment.clipTop,
      fragment.clipHeight,
      fragment.startLine,
      fragment.endLine
    );
  }

  /**
   * Render V2 paginated pages (simpler - just DOM elements)
   */
  private renderPagesV2(pages: { element: HTMLElement; pageNumber: number }[], options: ResolvedOptions) {
    if (!this.pagesContainer) return;

    this.pagesContainer.innerHTML = '';

    pages.forEach((page) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'folio-page';
      pageEl.setAttribute('data-page', String(page.pageNumber));
      pageEl.style.cssText = `
        width: ${options.pageWidth}px;
        height: ${options.pageHeight}px;
        padding: ${options.padding.top}px ${options.padding.right}px ${options.padding.bottom}px ${options.padding.left}px;
        box-sizing: border-box;
        background: white;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        overflow: hidden;
        position: relative;
      `;

      // V2 pages already have the content ready
      const contentEl = page.element.cloneNode(true) as HTMLElement;
      pageEl.appendChild(contentEl);
      this.pagesContainer!.appendChild(pageEl);
    });
  }

  /**
   * Inject default styles
   */
  private injectStyles() {
    const styleId = 'folio-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      folio-pages {
        display: block;
        position: relative;
      }

      .folio-pages {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        padding: 20px;
        background: #f0f0f0;
      }

      .folio-page {
        page-break-after: always;
      }

      .folio-measure {
        position: absolute !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      @media print {
        .folio-pages {
          padding: 0;
          background: none;
          gap: 0;
        }

        .folio-page {
          margin: 0;
          box-shadow: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Force re-pagination (re-captures current content)
   */
  public refresh() {
    // Re-capture content (excluding our own internal elements)
    this.originalContent = document.createDocumentFragment();
    const children = Array.from(this.children);
    for (const child of children) {
      if (child === this.pagesContainer) continue;
      if (child.classList?.contains('folio-measure')) continue;
      this.originalContent.appendChild(child);
    }

    // Ensure pagesContainer exists
    if (!this.pagesContainer) {
      this.pagesContainer = document.createElement('div');
      this.pagesContainer.className = 'folio-pages';
      this.appendChild(this.pagesContainer);
    }

    this.doPaginate();
  }

  /**
   * Public method to trigger re-pagination
   */
  public paginate() {
    this.doPaginate();
  }

  /**
   * Generate print-ready HTML string for PDF generation
   * @param options.includeStyles - Include computed styles (default: true)
   * @param options.title - Document title
   */
  public toPrintHTML(options: { includeStyles?: boolean; title?: string } = {}): string {
    const { includeStyles = true, title = 'Document' } = options;

    if (!this.pagesContainer) {
      return '';
    }

    const pageOptions = this.getOptions();
    const pageWidth = pageOptions.pageWidth || PAGE_SIZES.A4.width;
    const pageHeight = pageOptions.pageHeight || PAGE_SIZES.A4.height;

    // Collect styles from the document
    let styles = '';
    if (includeStyles) {
      // Get all stylesheets
      const styleSheets = Array.from(document.styleSheets);
      for (const sheet of styleSheets) {
        try {
          if (sheet.cssRules) {
            for (const rule of sheet.cssRules) {
              styles += rule.cssText + '\n';
            }
          }
        } catch {
          // Skip cross-origin stylesheets
        }
      }

      // Get inline styles
      const inlineStyles = document.querySelectorAll('style');
      inlineStyles.forEach(s => {
        styles += s.textContent + '\n';
      });
    }

    // Build print-specific styles
    const printStyles = `
      @page {
        size: ${pageWidth}px ${pageHeight}px;
        margin: 0;
      }

      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      html, body {
        margin: 0;
        padding: 0;
        background: white;
      }

      .folio-print-page {
        width: ${pageWidth}px;
        height: ${pageHeight}px;
        box-sizing: border-box;
        overflow: hidden;
        page-break-after: always;
        page-break-inside: avoid;
        background: white;
      }

      .folio-print-page:last-child {
        page-break-after: auto;
      }

      @media screen {
        body {
          background: #f0f0f0;
          padding: 20px;
        }

        .folio-print-page {
          margin: 0 auto 20px auto;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
      }
    `;

    // Clone and transform pages
    const pagesHTML: string[] = [];
    const pages = this.pagesContainer.querySelectorAll('.folio-page');

    pages.forEach((page, index) => {
      const clone = page.cloneNode(true) as HTMLElement;
      clone.className = 'folio-print-page';
      clone.setAttribute('data-page', String(index + 1));
      // Keep inline styles from original
      pagesHTML.push(clone.outerHTML);
    });

    // Build complete HTML document
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHTML(title)}</title>
  <style>
${styles}
${printStyles}
  </style>
</head>
<body>
${pagesHTML.join('\n')}
</body>
</html>`;
  }

  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// Register custom element
if (typeof customElements !== 'undefined') {
  customElements.define('folio-pages', FolioElement);
}
