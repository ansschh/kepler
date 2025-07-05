"use client";

import React, { useState, useEffect, useRef } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

// Add global pdfjsLib type
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const pdfjsLib = window.pdfjsLib;
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { initPDFJS } from '@/lib/pdf';
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface EnhancedPDFViewerProps {
  data: Uint8Array | null;
  fileName?: string;
}

export function EnhancedPDFViewer({ data, fileName }: EnhancedPDFViewerProps) {
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initPDFJS().then(() => {
      loadPDF();
    });
  }, [data]);

  const loadPDF = async () => {
    if (!data) return;

    try {
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      setPdfDocument(pdf);
      setTotalPages(pdf.numPages);
      renderPage(1, pdf);
    } catch (error) {
      console.error('Error loading PDF:', error);
    }
  };

  const renderPage = async (pageNum: number, doc = pdfDocument) => {
    if (!doc || !canvasRef.current || !textLayerRef.current) return;

    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale, rotation });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Clear any previous content
      textLayerRef.current.innerHTML = '';
      textLayerRef.current.style.width = `${viewport.width}px`;
      textLayerRef.current.style.height = `${viewport.height}px`;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Get text content but filter out any page number-like text
      const textContent = await page.getTextContent();
      const filteredTextContent = {
        ...textContent,
        items: textContent.items.filter((item: any) => {
          const text = item.str?.trim();
          // Filter out standalone page numbers
          return !(/^Page\s+\d+$|^\d+$/.test(text));
        })
      };

      pdfjsLib.renderTextLayer({
        textContent: filteredTextContent,
        container: textLayerRef.current,
        viewport,
        textDivs: []
      });
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      renderPage(newPage);
    }
  };

  const handleZoom = (delta: number) => {
    const newScale = Math.max(0.25, Math.min(5, scale + delta));
    setScale(newScale);
    renderPage(currentPage);
  };

  const handleRotate = (delta: number) => {
    setRotation((prev) => (prev + delta) % 360);
    renderPage(currentPage);
  };

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (!data) {
    return (
      <Card className="w-full h-full flex items-center justify-center">
        <p className="text-gray-500">No PDF data available</p>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col" ref={containerRef}>
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleZoom(-0.1)}
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleZoom(0.1)}
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRotate(-90)}
            title="Rotate Left"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRotate(90)}
            title="Rotate Right"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-gray-100">
        <div className="pdf-page-wrapper mx-auto bg-white rounded-sm shadow-md"
          style={{
            width: 'fit-content',
            padding: '1rem',
            position: 'relative'
          }}
        >
          <canvas ref={canvasRef} className="pdf-canvas" style={{ display: 'block' }} />
          <div 
            ref={textLayerRef} 
            className="textLayer" 
            style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              overflow: 'hidden',
              opacity: 1,
              lineHeight: 1.0
            }} 
          />
        </div>
      </div>
    </Card>
  );
}
