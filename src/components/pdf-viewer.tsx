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
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PDFViewerProps {
  pdfData: Uint8Array | null;
  fileName: string;
}

export function PDFViewer({ pdfData, fileName }: PDFViewerProps) {
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
  const [totalPages, setTotalPages] = useState(0);

  /* ---------------------------- PDF loading ---------------------------- */
  useEffect(() => {
    async function loadPdfDocument() {
      if (!pdfData) return;

      setIsLoading(true);
      setError(null);

      try {
        const pdfDoc = await loadPDF(pdfData);
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);

        // Load all pages
        const pages = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          pages.push(page);
        }
        setPdfPages(pages);

        // Calculate total content height
        const firstPage = pages[0];
        const { height } = getPageDimensions(firstPage, scale);
        setTotalContentHeight(height * pdfDoc.numPages + (pdfDoc.numPages - 1) * 20); // 20px gap
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setIsLoading(false);
      }
    }

    loadPdfDocument();
  }, [pdfData, scale]);

  /* ---------------------------- Page rendering ---------------------------- */
  useEffect(() => {
    if (!contentRef.current || pdfPages.length === 0) return;

    const container = contentRef.current;
    container.innerHTML = ''; // Clear existing content

    pdfPages.forEach(async (page, index) => {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page';
      container.appendChild(pageDiv);

      try {
        await renderPageWithTextLayer(page, pageDiv, scale);
      } catch (err) {
        console.error(`Error rendering page ${index + 1}:`, err);
      }
    });
  }, [pdfPages, scale]);

  /* ---------------------------- Scroll handling ---------------------------- */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !pdf) return;

    const handleScroll = () => {
      const { scrollTop, clientHeight } = viewport;
      const pageHeight = (totalContentHeight / pdf.numPages);
      const newPage = Math.floor((scrollTop + clientHeight / 2) / pageHeight) + 1;
      setCurrentPage(Math.max(1, Math.min(newPage, pdf.numPages)));
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [pdf, totalContentHeight]);

  /* ---------------------------- Zoom handling ---------------------------- */
  const handleWheel = useCallback((e: ReactWheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY * -0.01;
      setScale(prev => Math.min(Math.max(prev + delta, 0.5), 2.0));
    }
  }, []);

  const zoomIn = () => setScale(prev => Math.min(prev + 0.1, 2.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const resetZoom = () => setScale(1.0);

  /* ---------------------------- Page navigation ---------------------------- */
  const goToPage = (page: number) => {
    if (!viewportRef.current || !pdf) return;
    
    const targetPage = Math.max(1, Math.min(page, pdf.numPages));
    setCurrentPage(targetPage);

    const pageHeight = totalContentHeight / pdf.numPages;
    viewportRef.current.scrollTop = (targetPage - 1) * pageHeight;
  };

  if (error) {
    return (
      <div className="pdf-viewer-error">
        <p>Error loading PDF: {error}</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer-toolbar">
        <div className="pdf-viewer-left">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(1)}
            disabled={currentPage <= 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="pdf-viewer-page-select">
            <Input
              type="number"
              value={currentPage}
              min={1}
              max={totalPages}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-16 text-center"
            />
            <span>of {totalPages}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage >= totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="pdf-viewer-right">
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={resetZoom}
            className="min-w-[4rem]"
          >
            {Math.round(scale * 100)}%
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={scale >= 2.0}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="pdf-viewer-content"
        onWheel={handleWheel}
      >
        {isLoading ? (
          <div className="pdf-viewer-loading">
            <div className="pdf-viewer-loading-spinner" />
            <p>Loading PDF...</p>
          </div>
        ) : (
          <div
            ref={contentRef}
            style={{
              minHeight: totalContentHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top center'
            }}
            className="pdf-viewer-pages"
          />
        )}
      </div>
    </div>
  );
}
