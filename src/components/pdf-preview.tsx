"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  WheelEvent as ReactWheelEvent,
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
}

export function PDFPreview({ pdfData }: PDFPreviewProps) {
  /* ----------------------------- state & refs ---------------------------- */
  const [totalContentHeight, setTotalContentHeight] = useState(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null); // scroll container
  const contentRef = useRef<HTMLDivElement>(null); // scaled inner container

  const [scale, setScale] = useState(1);
  const [pdfPages, setPdfPages] = useState<PDFPageProxy[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  /* ----------------------- helper: detect visible page ------------------- */
  const updateCurrentPage = useCallback(() => {
    if (!viewportRef.current) return;

    const viewportRect = viewportRef.current.getBoundingClientRect();
    const pageEls = viewportRef.current.querySelectorAll(".pdf-page-wrapper");

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

  /* --------------------------- render each page -------------------------- */
  const renderPages = useCallback(
    async (pages: PDFPageProxy[], renderScale = 1) => {
      const containers = document.querySelectorAll(".pdf-page-container");
      if (containers.length !== pages.length) return;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const container = containers[i] as HTMLElement;
        const wrapper = container.closest(".pdf-page-wrapper") as HTMLElement;

        try {
          const dims = getPageDimensions(page, 1);
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

      setTimeout(updateCurrentPage, 100);
    },
    [updateCurrentPage]
  );

  /* -------------------------- load PDF document -------------------------- */
  useEffect(() => {
    if (!pdfData) return;

    const loadDocument = async () => {
      setIsLoading(true);
      setError(null);
      setPdfPages([]);

      try {
        await initPDFJS();
        const doc = await loadPDF(pdfData);
        setPdf(doc);

        const pages: PDFPageProxy[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          pages.push(await doc.getPage(i));
        }
        setPdfPages(pages);
      } catch (err) {
        console.error("Error loading PDF:", err);
        setError(err instanceof Error ? err.message : "Failed to load PDF");
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [pdfData]);

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
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleResetZoom = () => setScale(1);

  /* ---------------------------- wheel zoom logic ------------------------- */
  const handleWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => Math.min(Math.max(s * factor, 0.5), 3));
    }
  }, []);

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
    if (contentRef.current)
      contentRef.current.style.transform = `scale(${scale})`;
  }, [scale]);

  /* ----------------------------------------------------------------------- */
  return (
    <div
      className="flex flex-col w-full h-full bg-white"
      style={{ height: "100vh" }}
    >
      {/* Header */}
      {!isLoading && !error && pdfPages.length > 0 && (
        <div className="sticky top-0 z-10 bg-white border-b p-2 flex items-center justify-between shadow-sm">
          {/* left */}
          <div className="flex items-center gap-3">
            <span className="bg-blue-100 text-blue-800 font-medium px-2 py-1 rounded-md text-sm">
              PDF Output
            </span>
            <span className="text-sm text-slate-600 font-medium">
              Page {currentPage} of {pdfPages.length}
            </span>
          </div>

          {/* controls */}
          <div className="flex gap-2 items-center">
            {/* page nav */}
            <div className="flex gap-1 mr-2 border-r pr-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-slate-100"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous page</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Input
                type="number"
                className="w-12 h-8 text-center"
                value={currentPage}
                min={1}
                max={pdf?.numPages || 1}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (isNaN(v)) return;
                  if (!pdf) return;
                  if (v >= 1 && v <= pdf.numPages) setCurrentPage(v);
                }}
              />

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-slate-100"
                      disabled={!pdf || currentPage >= pdf.numPages}
                      onClick={() =>
                        setCurrentPage((p) =>
                          Math.min((pdf?.numPages || 1), p + 1)
                        )
                      }
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next page</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* zoom */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={scale <= 0.5}
                    onClick={handleZoomOut}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <span className="text-xs font-medium px-2 bg-slate-50 border rounded-md py-1 w-14 text-center">
              {Math.round(scale * 100)}%
            </span>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={scale >= 3}
                    onClick={handleZoomIn}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 ml-1"
                    disabled={scale === 1}
                    onClick={handleResetZoom}
                  >
                    <span className="text-xs font-medium">100%</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset zoom</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* placeholder search button */}
            <div className="border-l pl-2 ml-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-slate-100"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Search PDF</TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

      {/* content */}
      {!isLoading && !error && (
        <div
          ref={viewportRef}
          className="flex-1 overflow-y-auto w-full bg-gray-100 relative"
          onScroll={updateCurrentPage}
          onWheel={handleWheel}
          style={{ position: "relative" }}
        >
          <div
            ref={contentRef}
            className="flex flex-col items-center pt-10 pb-20 px-8"
            style={{
              minWidth: "100%",
              transformOrigin: "center top",
              minHeight:
                totalContentHeight > 0 ? totalContentHeight : "100%",
              transform: `scale(${scale})`,
              willChange: "transform",
            }}
          >
            {pdfPages.map((_, idx) => (
              <div
                key={idx}
                className="pdf-page-wrapper mb-10"
                style={{ width: "fit-content" }}
              >
                <div
                  className="relative"
                  style={{ boxShadow: "0 4px 10px rgba(0,0,0,0.2)" }}
                >
                  <div className="absolute -top-6 left-0 right-0 text-center text-sm text-gray-500">
                    Page {idx + 1}
                  </div>

                  <div className="bg-white border border-gray-300 p-2">
                    <div className="pdf-page-container relative" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
