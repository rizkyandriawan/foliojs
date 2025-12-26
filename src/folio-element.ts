import type { PaginateOptions, PageSizePreset, Orientation, Page, PageFragment } from './types.js';
import { PAGE_SIZES } from './types.js';
import { paginate } from './paginate.js';

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
  ];

  private originalContent: DocumentFragment | null = null;
  private pagesContainer: HTMLDivElement | null = null;
  private isPaginating = false;

  constructor() {
    super();
  }

  connectedCallback() {
    // Store original content
    this.originalContent = document.createDocumentFragment();
    while (this.firstChild) {
      this.originalContent.appendChild(this.firstChild);
    }

    // Create pages container
    this.pagesContainer = document.createElement('div');
    this.pagesContainer.className = 'folio-pages';
    this.appendChild(this.pagesContainer);

    // Add default styles
    this.injectStyles();

    // Paginate
    this.doPaginate();
  }

  disconnectedCallback() {
    this.originalContent = null;
    this.pagesContainer = null;
  }

  attributeChangedCallback() {
    if (this.isConnected && !this.isPaginating) {
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

    this.isPaginating = true;

    try {
      // Create a hidden measurement container
      const measureContainer = document.createElement('div');
      measureContainer.className = 'folio-measure';
      measureContainer.style.cssText = `
        position: absolute;
        visibility: hidden;
        width: ${this.getOptions().pageWidth || PAGE_SIZES.A4.width}px;
      `;

      // Clone content into measurement container
      const contentClone = this.originalContent.cloneNode(true);
      measureContainer.appendChild(contentClone);
      document.body.appendChild(measureContainer);

      // Get options and paginate
      const options = this.getOptions();
      const result = await paginate(measureContainer, options);

      // Clean up measurement container
      document.body.removeChild(measureContainer);

      // Render pages
      this.renderPages(result.pages, result.options);

      // Dispatch event
      this.dispatchEvent(new CustomEvent('paginated', {
        detail: {
          totalPages: result.totalPages,
          options: result.options,
        },
      }));
    } catch (error) {
      console.error('Folio pagination error:', error);
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
    } finally {
      this.isPaginating = false;
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
   * Render a single fragment
   */
  private renderFragment(fragment: PageFragment, _sourceContainer: HTMLElement): HTMLElement | null {
    const sourceEl = fragment.block.element;

    // Find the corresponding element in source container
    // For simplicity, clone the original element
    const clone = sourceEl.cloneNode(true) as HTMLElement;

    if (fragment.isPartial) {
      // Apply clipping for partial fragments
      clone.style.overflow = 'hidden';

      if (fragment.clipTop !== undefined && fragment.clipHeight !== undefined) {
        clone.style.height = `${fragment.clipHeight}px`;
        clone.style.marginTop = `-${fragment.clipTop}px`;

        // Wrap in overflow container
        const wrapper = document.createElement('div');
        wrapper.style.overflow = 'hidden';
        wrapper.style.height = `${fragment.clipHeight}px`;
        wrapper.appendChild(clone);
        return wrapper;
      }
    }

    return clone;
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
   * Force re-pagination
   */
  public refresh() {
    this.doPaginate();
  }
}

// Register custom element
if (typeof customElements !== 'undefined') {
  customElements.define('folio-pages', FolioElement);
}
