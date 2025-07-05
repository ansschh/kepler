'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  WheelEvent as ReactWheelEvent,
} from 'react';
import {
  loadPDF,
  renderPageWithTextLayer,
  getPageDimensions,
  initPDFJS,
} from '@/lib/pdf';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  Search,
  RotateCw,
  Maximize,
  Minimize,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';

interface SidebarPDFPreviewProps {
  pdfData: Uint8Array | null;
  onClose?: () => void;
}

export function SidebarPDFPreview({ pdfData, onClose }: SidebarPDFPreviewProps) {
  /* ----------------------------- state & refs ---------------------------- */
  const [totalContentHeight, setTotalContentHeight] = useState(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null); // scroll container
  const contentRef = useRef<HTMLDivElement>(null); // scaled inner container
  const containerRef = useRef<HTMLDivElement>(null); // outer container for fullscreen

  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pdfPages, setPdfPages] = useState<PDFPageProxy[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  /* ----------------------- helper: detect visible page ------------------- */
  const updateCurrentPage = useCallback(() => {
    if (!viewportRef.current) return;

    const viewport = viewportRef.current;
    const viewportRect = viewport.getBoundingClientRect();
    const pageEls = viewport.querySelectorAll('.pdf-page-wrapper');

    let topPage = 1;
    let maxVis = 0;

    pageEls.forEach((pg, idx) => {
      const r = pg.getBoundingClientRect();
      const visibleTop = Math.max(r.top, viewportRect.top);
      const visibleBot = Math.min(r.bottom, viewportRect.bottom);
      const visible = Math.max(0, visibleBot - visibleTop);
      const ratio = visible / r.height;
      if (ratio > maxVis) {
        maxVis = ratio;
        topPage = idx + 1;
      }
    });

    if (topPage !== currentPage) setCurrentPage(topPage);
  }, [currentPage]);

  /* ----------------------- scroll to specific page ------------------- */
  const scrollToPage = useCallback((pageNum: number) => {
    if (!viewportRef.current) return;

    const viewport = viewportRef.current;
    const pageEls = viewport.querySelectorAll('.pdf-page-wrapper');
    if (pageNum < 1 || pageNum > pageEls.length) return;

    const targetPage = pageEls[pageNum - 1] as HTMLElement;
    const viewportRect = viewport.getBoundingClientRect();
    const pageRect = targetPage.getBoundingClientRect();

    viewport.scrollTo({
      top: viewport.scrollTop + (pageRect.top - viewportRect.top),
      behavior: 'smooth'
    });
  }, []);

  /* --------------------------- render each page -------------------------- */
  const renderPages = useCallback(
    async (pages: PDFPageProxy[], renderScale = 1) => {
      const containers = document.querySelectorAll('.pdf-page-container');
      if (containers.length !== pages.length) return;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const container = containers[i] as HTMLElement;
        const wrapper = container.closest('.pdf-page-wrapper') as HTMLElement;

        try {
          const dims = getPageDimensions(page, renderScale);
          container.style.width = `${dims.width}px`;
          container.style.height = `${dims.height}px`;

          if (wrapper) {
            const padding = 32; // 1rem * 2 * 16px
            const parent = wrapper.querySelector('div') as HTMLDivElement;
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

      setTimeout(updateCurrentPage, 100);
    },
    [updateCurrentPage]
  );

  /* ---------------------------- PDF.js initialization ---------------------------- */
  useEffect(() => {
    if (!isInitialized) {
      initPDFJS().then(() => setIsInitialized(true));
    }
  }, [isInitialized]);

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
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setIsLoading(false);
      }
    }

    loadPdfDocument();
  }, [pdfData, isInitialized]);

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
    renderPages(pdfPages, scale); // base render
  }, [pdfPages, renderPages, scale]);

  /* --------------- maintain scroll position when scale changes ----------- */
  useEffect(() => {
    if (!viewportRef.current || !contentRef.current) return;
    const vp = viewportRef.current;
    const content = contentRef.current;
    const ratio =
      vp.scrollTop / Math.max(content.scrollHeight - vp.clientHeight, 1);

    requestAnimationFrame(() => {
      const newTop =
        ratio * Math.max(content.scrollHeight - vp.clientHeight, 0);
      vp.scrollTop = newTop;
    });
  }, [scale]);

  /* ------------------------------ zoom helpers --------------------------- */
  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));
  const handleZoomChange = (value: number[]) => setScale(value[0]);

  /* ------------------------------ rotation helpers --------------------------- */
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  /* ------------------------------ fullscreen helpers --------------------------- */
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  /* ------------------------------ wheel zoom --------------------------- */
  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY * -0.01;
        setScale((s) => Math.min(Math.max(s + delta, 0.25), 3));
      }
    },
    []
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col w-full h-full bg-white"
      style={{ minHeight: '400px' }}
    >
      {/* toolbar */}
      <div className="flex items-center justify-between gap-2 p-2 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <div className="flex items-center min-w-[100px]">
            <Input
              type="number"
              min={1}
              max={pdfPages.length}
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= pdfPages.length) {
                  setCurrentPage(page);
                  scrollToPage(page);
                }
              }}
              className="w-16 text-center"
            />
            <span className="mx-1">/</span>
            <span>{pdfPages.length}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => scrollToPage(currentPage + 1)}
            disabled={currentPage >= pdfPages.length}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.25}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom Out</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="w-32">
            <Slider
              value={[scale]}
              min={0.25}
              max={3}
              step={0.25}
              onValueChange={handleZoomChange}
            />
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={scale >= 3}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom In</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleRotate}>
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rotate</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {/* error state */}
      {error && (
        <div className="flex-1 flex items-center justify-center text-red-500">
          {error}
        </div>
      )}

      {/* content */}
      {!isLoading && !error && (
        <div
          ref={viewportRef}
          className="flex-1 overflow-y-auto w-full bg-gray-100 relative scroll-smooth"
          onScroll={updateCurrentPage}
          onWheel={handleWheel}
          style={{ position: 'relative' }}
        >
          <div
            ref={contentRef}
            className="flex flex-col items-center py-8 px-4"
            style={{
              minWidth: '100%',
              transformOrigin: 'center top',
              minHeight: totalContentHeight > 0 ? totalContentHeight : '100%',
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              willChange: 'transform',
            }}
          >
            {pdfPages.map((page: PDFPageProxy, idx: number) => {
              const dims = getPageDimensions(page, scale);
              const padding = 32; // 1rem * 2 * 16px
              return (
                <div
                  key={idx}
                  className="pdf-page-wrapper mb-10 bg-white rounded-sm shadow-md"
                  style={{
                    width: 'fit-content',
                    padding: '1rem',
                    marginBottom: idx === pdfPages.length - 1 ? 0 : '2rem',
                  }}
                >
                  <div className="relative" style={{ width: 'fit-content' }}>
                    <div className="pdf-page-container" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
