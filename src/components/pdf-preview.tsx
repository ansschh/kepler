"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  WheelEvent as ReactWheelEvent,
  JSX,
} from "react";
import {
  loadPDF,
  renderPageWithTextLayer,
  getPageDimensions,
  initPDFJS,
} from "@/lib/pdf";
import { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/types/src/display/api";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PDFPreviewProps {
  pdfData: Uint8Array | null;
  currentPage?: number;
  scale?: number;
  onPageChange?: (page: number) => void;
  onScaleChange?: (scale: number) => void;
  onTotalPagesChange?: (total: number) => void;
  className?: string;
}

export function PDFPreview({ 
  pdfData, 
  currentPage: externalCurrentPage, 
  scale: externalScale,
  onPageChange,
  onScaleChange,
  onTotalPagesChange,
  className = ''
}: PDFPreviewProps): React.ReactElement {
  /* ----------------------------- state & refs ---------------------------- */
  const [totalContentHeight, setTotalContentHeight] = useState(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [scale, setScale] = useState(externalScale || 1);

  const viewportRef = useRef<HTMLDivElement>(null); // scroll container
  const contentRef = useRef<HTMLDivElement>(null); // scaled inner container

  const [pdfPages, setPdfPages] = useState<PDFPageProxy[]>([]);
  
  // Use external values if provided, otherwise use internal state
  const currentPage = externalCurrentPage ?? 1;
  
  // Notify parent of total pages when PDF is loaded
  useEffect(() => {
    if (pdfPages.length > 0) {
      onTotalPagesChange?.(pdfPages.length);
    }
  }, [pdfPages.length, onTotalPagesChange]);

  /* ----------------------- helper: detect visible page ------------------- */
  const updateCurrentPage = useCallback(() => {
    if (!viewportRef.current || !contentRef.current || pdfPages.length === 0) return;

    const containerRect = viewportRef.current.getBoundingClientRect();
    const containerTop = containerRect.top;
    const containerBottom = containerRect.bottom;

    // Find the first page that is mostly visible in the viewport
    const pageElements = contentRef.current.getElementsByClassName('pdf-page');
    let mostVisiblePage = 1;
    let maxVisibleArea = 0;

    for (let i = 0; i < pageElements.length; i++) {
      const pageElement = pageElements[i] as HTMLElement;
      const pageRect = pageElement.getBoundingClientRect();

      // Calculate visible area of the page
      const visibleTop = Math.max(pageRect.top, containerTop);
      const visibleBottom = Math.min(pageRect.bottom, containerBottom);
      const visibleArea = Math.max(0, visibleBottom - visibleTop);

      if (visibleArea > maxVisibleArea) {
        maxVisibleArea = visibleArea;
        mostVisiblePage = i + 1;
      }
    }

    onPageChange?.(mostVisiblePage);
  }, [pdfPages.length, onPageChange]);

  /* ----------------------- scroll to specific page ------------------- */
  const scrollToPage = useCallback((pageNum: number) => {
    if (!viewportRef.current || !contentRef.current) return;

    const pageEl = contentRef.current.querySelector(
      `.pdf-page-wrapper:nth-child(${pageNum})`
    );
    if (!pageEl) return;

    const containerRect = viewportRef.current.getBoundingClientRect();
    const pageRect = pageEl.getBoundingClientRect();
    const scrollTop = pageRect.top - containerRect.top + viewportRef.current.scrollTop;

    viewportRef.current.scrollTo({
      top: scrollTop,
      behavior: 'smooth',
    });

    onPageChange?.(pageNum);
  }, [onPageChange]);

  const handlePageUp = useCallback(() => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      onPageChange?.(newPage);
      scrollToPage(newPage);
    }
  }, [currentPage, scrollToPage, onPageChange]);

  const handlePageDown = useCallback(() => {
    if (currentPage < pdfPages.length) {
      const newPage = currentPage + 1;
      onPageChange?.(newPage);
      scrollToPage(newPage);
    }
  }, [currentPage, pdfPages.length, scrollToPage, onPageChange]);

  /* --------------------------- render each page -------------------------- */
  const renderPages = useCallback(
    async (pages: PDFPageProxy[], renderScale = scale) => {
      if (!pages.length) return;

      const containers = document.querySelectorAll(".pdf-page-container");
      if (containers.length !== pages.length) {
        console.warn('Container count mismatch:', containers.length, 'vs', pages.length);
        return;
      }

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const container = containers[i] as HTMLElement;
        const wrapper = container.closest(".pdf-page-wrapper") as HTMLElement;

        try {
          const dims = getPageDimensions(page, renderScale);
          container.style.width = `${dims.width}px`;
          container.style.height = `${dims.height}px`;

          if (wrapper) {
            const padding = 16; // 0.5rem * 2 * 16px
            const parent = wrapper.querySelector("div") as HTMLDivElement;
            if (parent) {
              parent.style.width = `${dims.width + padding}px`;
              parent.style.height = `${dims.height + padding}px`;
            }
          }

          await renderPageWithTextLayer(page, container, renderScale);
        } catch (err) {
          console.error(`Error rendering page ${i + 1}:`, err);
        }
      }

      // Update page visibility after rendering
      setTimeout(updateCurrentPage, 100);
    },
    [updateCurrentPage, scale]
  );

  /* --------------------------- PDF.js init ---------------------------- */
  useEffect(() => {
    const init = async () => {
      await initPDFJS();
      setIsInitialized(true);
    };
    init();
  }, []);

  /* ---------------------------- PDF loading ---------------------------- */
  useEffect(() => {
    async function loadPdfDocument() {
      if (!pdfData || !isInitialized) return;

      setIsLoading(true);
      setError(null);

      try {
        const pdfDoc = await loadPDF(pdfData);
        setPdf(pdfDoc);
        const pages: PDFPageProxy[] = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          pages.push(await pdfDoc.getPage(i));
        }
        setPdfPages(pages);

        onTotalPagesChange?.(pdfDoc.numPages);
        setIsLoading(false);

        // Re-render pages when scale changes
        renderPages(pages, scale);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF');
        setIsLoading(false);
      }
    }

    if (pdfData && isInitialized) {
      loadPdfDocument();
    }
  }, [pdfData, isInitialized, onTotalPagesChange, scale, renderPages]);

  /* ---------- update layout & render pages whenever pdfPages set --------- */
  useEffect(() => {
    if (pdfPages.length === 0) return;

    const calcHeight = () => {
      let h = 0;
      pdfPages.forEach((page: PDFPageProxy) => {
        const d = getPageDimensions(page, 1);
        h += d.height + 40; // extra margin
      });
      setTotalContentHeight(h);
    };

    calcHeight();
    renderPages(pdfPages, 1); // base render
  }, [pdfPages, renderPages]);

  /* ------------- sync external scale with internal state ------------- */
  useEffect(() => {
    if (externalScale !== undefined && externalScale !== scale) {
      setScale(externalScale);
    }
  }, [externalScale]);

  /* --------------------------- handle scale changes ------------------------ */
  useEffect(() => {
    if (!pdfPages.length || !scale) return;
    renderPages(pdfPages, scale);
  }, [scale, pdfPages, renderPages]);

  /* --------------- maintain scroll and center on scale change ----------- */
  useEffect(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    
    // Save scroll position relative to content
    const scrollRatio = vp.scrollTop / Math.max(ct.scrollHeight - vp.clientHeight, 1);
    
    // Get viewport dimensions once for calculations
    const vpWidth = vp.clientWidth;
    const vpHeight = vp.clientHeight;
    
    // Apply centering after layout stabilizes
    const applyScrollPositions = () => {
      if (!vp || !ct) return;
      
      // Restore vertical position
      vp.scrollTop = scrollRatio * Math.max(ct.scrollHeight - vpHeight, 0);
      
      // Force horizontal centering by calculating exact center position
      const newContentWidth = ct.scrollWidth;
      const idealLeft = Math.max(0, (newContentWidth - vpWidth) / 2);
      vp.scrollLeft = idealLeft;
    };
    
    // Apply centering multiple times to ensure it "sticks" after all reflows
    applyScrollPositions(); // Immediate application
    
    const timer1 = setTimeout(applyScrollPositions, 10); // Short delay
    const timer2 = setTimeout(applyScrollPositions, 100); // Longer delay as fallback
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [scale]);

  /* ------------------------------ zoom helpers --------------------------- */
  const handleZoomIn = () => {
    const newScale = Math.min(scale + 0.25, 3);
    setScale(newScale);
    onScaleChange?.(newScale);
  };
  
  const handleZoomOut = () => {
    const newScale = Math.max(scale - 0.25, 0.1);
    setScale(newScale);
    onScaleChange?.(newScale);
  };
  
  const handleResetZoom = () => {
    setScale(1);
    onScaleChange?.(1);
  };
  /* --------------------------- wheel handler ---------------------------- */
  const handleWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      
      // Implement CTRL+wheel zoom with smoother step size
      const delta = e.deltaY || e.deltaX;
      
      // Use smaller increments for smoother zoom
      const zoomFactor = delta > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(scale * zoomFactor, 0.1), 3.0);
      
      if (Math.abs(newScale - scale) > 0.01) {
        // Update scale with the current page preserved
        setScale(newScale);
        onScaleChange?.(newScale);
      }
    }
  }, [scale, onScaleChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        const newScale = Math.min(3, scale * 1.1);
        setScale(newScale);
        onScaleChange?.(newScale);
      } else if (e.key === '-') {
        e.preventDefault();
        const newScale = Math.max(0.1, scale * 0.9);
        setScale(newScale);
        onScaleChange?.(newScale);
      } else if (e.key === '0') {
        e.preventDefault();
        setScale(1);
        onScaleChange?.(1);
      }
    }
  }, [scale, onScaleChange]);

  /* ------------ prevent browser-level zoom while in component ------------ */
  useEffect(() => {
    const prevent = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    document.addEventListener("wheel", prevent, { passive: false });
    return () => document.removeEventListener("wheel", prevent);
  }, []);

  /* -------------------------- apply CSS transform ------------------------ */
  useEffect(() => {
    if (!contentRef.current) return;

    // Apply scale transform and update page containers
    if (pdfPages.length > 0) {
      renderPages(pdfPages, scale);
    }
  }, [contentRef, pdfPages, scale, renderPages]);

/* ---------- update layout & render pages whenever pdfPages set --------- */
useEffect(() => {
  if (pdfPages.length === 0) return;

  const calcHeight = () => {
    let h = 0;
    pdfPages.forEach((p) => {
      const d = getPageDimensions(p, 1);
      h += d.height + 40; // extra margin
    });
    setTotalContentHeight(h);
  };

  calcHeight();
  renderPages(pdfPages, 1); // base render
}, [pdfPages, renderPages]);

return (
  <div className="flex flex-col w-full h-full bg-white relative overflow-hidden">
    {/* content */}
    {!isLoading && !error && (
      <div
        ref={viewportRef}
        className="flex-1 overflow-y-auto w-full bg-gray-100 scroll-smooth"
        onScroll={updateCurrentPage}
        onWheel={handleWheel}
      >
        <div
          className="w-full flex justify-center">
          <div
            ref={contentRef}
            className="flex flex-col items-center py-8 px-4 inline-block"
            style={{
              transformOrigin: "top center",
              minHeight: totalContentHeight > 0 ? totalContentHeight : "100%",
              transform: `scale(${scale})`,
              willChange: "transform",
              display: "inline-flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center"
            }}
          >
          {pdfPages.map((page: PDFPageProxy, idx: number) => {
            const dims = getPageDimensions(page, scale);
            const padding = 32; // 1rem * 2 * 16px
            return (
              <div
                key={idx}
                className="pdf-page-wrapper"
                style={{
                  width: "fit-content",
                  padding: "0",
                  marginBottom: idx === pdfPages.length - 1 ? 0 : "1rem"
                }}
              >
                <div
                  className="relative"
                  style={{ width: "fit-content" }}
                >
                  <div className="pdf-page-container" />
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    )}

    {/* error */}
    {error && (
      <div className="p-4 text-red-500">Error: {error}</div>
    )}

    {/* loading */}
    {isLoading && (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading PDF...</span>
      </div>
    )}
  </div>
)};
