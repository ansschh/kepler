'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { loadPDF, initPDFJS } from '@/lib/pdf';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Printer,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ChromePDFViewerProps {
  pdfData: Uint8Array | null;
  fileName?: string;
}

export function ChromePDFViewer({ pdfData, fileName }: ChromePDFViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Initialize PDF.js
  useEffect(() => {
    if (!isInitialized) {
      initPDFJS().then(() => setIsInitialized(true));
    }
  }, [isInitialized]);

  // Load PDF when data is available
  useEffect(() => {
    async function loadDocument() {
      if (!pdfData || !isInitialized) return;

      setIsLoading(true);
      setError(null);

      try {
        const pdfDoc = await loadPDF(pdfData);
        setPdf(pdfDoc);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      } finally {
        setIsLoading(false);
      }
    }

    loadDocument();
  }, [pdfData, isInitialized]);

  // Render current page
  useEffect(() => {
    async function renderPage() {
      if (!pdf || !viewerRef.current) return;

      try {
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale, rotation });

        // Create or get canvas
        let canvas = viewerRef.current.querySelector('canvas');
        if (!canvas) {
          canvas = document.createElement('canvas');
          viewerRef.current.appendChild(canvas);
        }

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        // Create or get text layer
        let textLayer = viewerRef.current.querySelector('.textLayer');
        if (!textLayer) {
          textLayer = document.createElement('div');
          textLayer.className = 'textLayer';
          viewerRef.current.appendChild(textLayer);
        }

        // Clear previous text layer content
        textLayer.innerHTML = '';

        // Position text layer
        const textLayerElement = textLayer as HTMLDivElement;
        textLayerElement.style.width = `${viewport.width}px`;
        textLayerElement.style.height = `${viewport.height}px`;

        // Get text content and render
        const textContent = await page.getTextContent();
        await (window as any).pdfjsLib.renderTextLayer({
          textContent,
          container: textLayer,
          viewport,
          textDivs: [],
        }).promise;

      } catch (err) {
        console.error('Error rendering page:', err);
      }
    }

    renderPage();
  }, [pdf, currentPage, scale, rotation]);

  const handlePageChange = (newPage: number) => {
    if (pdf && newPage >= 1 && newPage <= pdf.numPages) {
      setCurrentPage(newPage);
    }
  };

  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.25));
  const handleRotate = () => setRotation(r => (r + 90) % 360);

  const handleDownload = () => {
    if (!pdfData || !fileName) return;
    
    const blob = new Blob([pdfData], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!pdfData) return;
    
    const blob = new Blob([pdfData], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.contentWindow?.print();
    document.body.removeChild(iframe);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#303030] text-white" ref={containerRef}>
      {/* Chrome-style toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-600">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-gray-700"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!pdf || currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={currentPage}
              onChange={(e) => handlePageChange(parseInt(e.target.value) || 1)}
              className="w-16 h-8 bg-gray-700 border-gray-600 text-white text-center"
            />
            <span className="text-sm">/ {pdf?.numPages || 1}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-gray-700"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!pdf || currentPage >= (pdf?.numPages || 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 ml-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-gray-700"
            onClick={handleZoomOut}
            disabled={scale <= 0.25}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <span className="text-sm min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-gray-700"
            onClick={handleZoomIn}
            disabled={scale >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:bg-gray-700"
          onClick={handleRotate}
        >
          <RotateCw className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 ml-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-gray-700"
            onClick={handleDownload}
            disabled={!pdfData || !fileName}
          >
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:bg-gray-700"
            onClick={handlePrint}
            disabled={!pdfData}
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-[#525659] flex justify-center">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-white"></div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full text-red-400">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <div
            ref={viewerRef}
            className="relative bg-white shadow-lg m-4"
            style={{
              width: 'fit-content',
              height: 'fit-content',
            }}
          >
            {/* Canvas and text layer will be rendered here */}
          </div>
        )}
      </div>

      <style jsx global>{`
        .textLayer {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          opacity: 0.2;
          line-height: 1.0;
          user-select: text;
        }

        .textLayer > span {
          position: absolute;
          color: transparent;
          white-space: pre;
          cursor: text;
          transform-origin: 0% 0%;
        }

        .textLayer ::selection {
          background: rgba(0, 0, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
