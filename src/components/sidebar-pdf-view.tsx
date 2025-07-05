"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  WheelEvent as ReactWheelEvent,
} from "react";
import {
  loadSidebarPDF,
  renderSidebarPageWithTextLayer,
  getSidebarPageDimensions,
  initSidebarPDFJS,
} from "@/lib/sidebar-pdf";
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

interface SidebarPDFViewProps {
  pdfData: Uint8Array | null;
  fileName?: string;
}

export function SidebarPDFView({ pdfData, fileName }: SidebarPDFViewProps) {
  /* ----------------------------- state & refs ---------------------------- */
  const [totalContentHeight, setTotalContentHeight] = useState(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  const [scale, setScale] = useState(1);
  const [pdfPages, setPdfPages] = useState<PDFPageProxy[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  /* ----------------------- helper: detect visible page ------------------- */
  const updateCurrentPage = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const vpRect = vp.getBoundingClientRect();
    const wrappers = vp.querySelectorAll(".pdf-page-wrapper");
    let bestPage = 1;
    let bestVis = 0;
    wrappers.forEach((el, idx) => {
      const r = el.getBoundingClientRect();
      const visTop = Math.max(r.top, vpRect.top);
      const visBot = Math.min(r.bottom, vpRect.bottom);
      const vis = Math.max(0, visBot - visTop);
      const ratio = vis / r.height;
      if (ratio > bestVis) {
        bestVis = ratio;
        bestPage = idx + 1;
      }
    });
    if (bestPage !== currentPage) setCurrentPage(bestPage);
  }, [currentPage]);

  /* ----------------------- scroll to specific page ------------------- */
  const scrollToPage = useCallback((pageNum: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const wrappers = vp.querySelectorAll(".pdf-page-wrapper");
    if (pageNum < 1 || pageNum > wrappers.length) return;
    const target = wrappers[pageNum - 1] as HTMLElement;
    const vpRect = vp.getBoundingClientRect();
    const pgRect = target.getBoundingClientRect();
    vp.scrollTo({
      top: vp.scrollTop + (pgRect.top - vpRect.top),
      behavior: "smooth",
    });
  }, []);

  /* --------------------------- render each page -------------------------- */
  const renderPages = useCallback(
    (pages: PDFPageProxy[], renderScale: number) => {
      const containers = contentRef.current?.querySelectorAll(".pdf-page-container") ?? [];
      if (containers.length !== pages.length) return;
      let done = 0, failed = 0;
      pages.forEach((page, i) => {
        const container = containers[i] as HTMLElement;
        container.innerHTML = "";
        const dims = getSidebarPageDimensions(page, 1);
        container.style.width = `${dims.width}px`;
        container.style.height = `${dims.height}px`;
        const canvas = document.createElement("canvas");
        canvas.className = "pdf-canvas";
        container.appendChild(canvas);
        const textLayer = document.createElement("div");
        textLayer.className = "textLayer";
        container.appendChild(textLayer);
        window.requestAnimationFrame(async () => {
          try {
            await renderSidebarPageWithTextLayer(page, container, renderScale);
            done++;
          } catch {
            failed++;
          }
        });
      });
      const summaryTimer = window.setTimeout(() => {
        console.log(`Rendered ${done}/${pages.length}, failed ${failed}`);
      }, 1000);
      timersRef.current.push(summaryTimer);
    },
    []
  );

  /* ---------------------------- PDF.js initialization ---------------------------- */
  useEffect(() => {
    if (!isInitialized) {
      initSidebarPDFJS()
        .then(() => setIsInitialized(true))
        .catch((e) => {
          console.error("PDFJS init error", e);
          setError("Failed to initialize PDF renderer");
        });
    }
  }, [isInitialized]);

  /* ---------------------------- PDF loading ---------------------------- */
  useEffect(() => {
    if (!pdfData) return;
    let mounted = true;
    setIsLoading(true);
    setPdfPages([]);
    setError(null);
    if (pdf) {
      pdf.destroy().catch(() => {});
      setPdf(null);
    }
    initSidebarPDFJS()
      .then(() => loadSidebarPDF(pdfData))
      .then((loaded) => {
        if (!mounted) {
          loaded.destroy();
        } else {
          setPdf(loaded);
        }
      })
      .catch((e) => {
        console.error("Load PDF error", e);
        if (mounted) setError(`Failed to load PDF: ${e instanceof Error ? e.message : "Unknown"}`);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
      if (pdf) pdf.destroy().catch(() => {});
    };
  }, [pdfData]);

  /* ---------------------------- load pages ---------------------------- */
  useEffect(() => {
    if (!pdf) return;
    let mounted = true;
    (async () => {
      try {
        const pages: PDFPageProxy[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (!mounted) return;
          pages.push(await pdf.getPage(i));
        }
        if (mounted) setPdfPages(pages);
      } catch (e) {
        console.error("Load pages error", e);
        if (mounted) setError(`Failed to load pages: ${e instanceof Error ? e.message : "Unknown"}`);
      }
    })();
    return () => { mounted = false; };
  }, [pdf]);

  /* ---------------- update layout & render on pdfPages/scale change -------- */
  useEffect(() => {
    if (!contentRef.current || pdfPages.length === 0) return;
    // clear timers
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

    // compute total height
    let h = 0;
    pdfPages.forEach((p) => {
      const d = getSidebarPageDimensions(p, 1);
      h += d.height + 40;
    });
    setTotalContentHeight(h);
    // rebuild containers
    const containerEl = contentRef.current;
    containerEl.innerHTML = "";
    pdfPages.forEach((_, idx) => {
      const wrapper = document.createElement("div");
      wrapper.className = "pdf-page-wrapper mb-10 bg-white rounded-sm shadow-md";
      wrapper.style.width = "fit-content";
      wrapper.style.padding = "1rem";
      wrapper.style.marginBottom = idx === pdfPages.length - 1 ? "0" : "2rem";
      const inner = document.createElement("div");
      inner.className = "relative";
      inner.style.width = "fit-content";
      const pageContainer = document.createElement("div");
      pageContainer.className = "pdf-page-container";
      inner.appendChild(pageContainer);
      wrapper.appendChild(inner);
      containerEl.appendChild(wrapper);
    });
    // render after a tick
    const renderTimer = window.setTimeout(() => {
      renderPages(pdfPages, scale);
    }, 50);
    timersRef.current.push(renderTimer);

    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, [pdfPages, scale, renderPages]);

  /* --------------- maintain scroll on scale change ----------- */
  useEffect(() => {
    const vp = viewportRef.current;
    const ct = contentRef.current;
    if (!vp || !ct) return;
    const ratio = vp.scrollTop / Math.max(ct.scrollHeight - vp.clientHeight, 1);
    requestAnimationFrame(() => {
      vp.scrollTop = ratio * Math.max(ct.scrollHeight - vp.clientHeight, 0);
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
      const f = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => Math.min(Math.max(s * f, 0.5), 3));
    }
  }, []);

  /* ------------ prevent browser zoom ------------ */
  useEffect(() => {
    const prevent = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    document.addEventListener("wheel", prevent, { passive: false });
    return () => document.removeEventListener("wheel", prevent);
  }, []);

  return (
    <div className="flex flex-col w-full h-full bg-white relative overflow-hidden">
      {/* Header */}
      {!isLoading && !error && pdfPages.length > 0 && (
        <div className="flex-none bg-white border-b p-2 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="bg-blue-100 text-blue-800 font-medium px-2 py-1 rounded-md text-sm">
              {fileName ?? "PDF File"}
            </span>
            <span className="text-sm text-slate-600 font-medium">
              Page {currentPage} of {pdfPages.length}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex gap-1 mr-2 border-r pr-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={currentPage <= 1}
                      onClick={() => {
                        const np = Math.max(1, currentPage - 1);
                        setCurrentPage(np);
                        scrollToPage(np);
                      }}
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
                max={pdf?.numPages ?? 1}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!pdf || isNaN(v)) return;
                  if (v >= 1 && v <= pdf.numPages) {
                    setCurrentPage(v);
                    scrollToPage(v);
                  }
                }}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!pdf || currentPage >= pdf.numPages}
                      onClick={() => {
                        const np = Math.min(pdf?.numPages ?? 1, currentPage + 1);
                        setCurrentPage(np);
                        scrollToPage(np);
                      }}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next page</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" disabled={scale <= 0.5} onClick={handleZoomOut}>
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
                  <Button variant="outline" size="icon" disabled={scale >= 3} onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={scale === 1} onClick={handleResetZoom}>
                    <span className="text-xs font-medium">100%</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset zoom</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="border-l pl-2 ml-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon">
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

      {error && <div className="p-4 text-red-500">Error: {error}</div>}

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading PDF...</span>
        </div>
      )}

      {!isLoading && !error && (
        <div
          ref={viewportRef}
          className="flex-1 overflow-y-auto w-full bg-gray-100 scroll-smooth"
          onScroll={updateCurrentPage}
          onWheel={handleWheel}
        >
          <div
            ref={contentRef}
            className="flex flex-col items-center py-8 px-4 w-full"
            style={{
              transformOrigin: 'top center',
              minHeight: totalContentHeight || undefined,
              transform: `scale(${scale})`,
              height: 'fit-content',
              width: '100%',
              display: 'flex',
              justifyContent: 'center'
            }}
          />
        </div>
      )}
    </div>
  );
}
