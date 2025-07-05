'use client';

import { type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

// Create a completely separate PDF.js instance for the sidebar PDF viewer
let sidebarPdfjsLib: typeof import('pdfjs-dist');

export const initSidebarPDFJS = async () => {
  if (typeof window === 'undefined') return null;

  try {
    console.log('Initializing Sidebar PDF.js library');
    if (!sidebarPdfjsLib) {
      sidebarPdfjsLib = await import('pdfjs-dist');
      
      // Try to use local worker path; fallback to CDN if not reachable
      let sidebarWorkerUrl = '/pdf-worker/pdf.worker.min.js';
      try {
        // Make a HEAD request to check if the local worker file exists
        await fetch(sidebarWorkerUrl, { method: 'HEAD', cache: 'no-cache' });
        console.log(`Using local sidebar PDF.js worker source: ${sidebarWorkerUrl}`);
      } catch {
        // Fallback to CDN based on pdf.js version
        sidebarWorkerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${sidebarPdfjsLib.version}/pdf.worker.min.js`;
        console.warn(`Local worker not found; falling back to CDN worker: ${sidebarWorkerUrl}`);
      }
      // Important: setting a specific instance for sidebar only
      sidebarPdfjsLib.GlobalWorkerOptions.workerSrc = sidebarWorkerUrl;
      console.log('Sidebar PDF.js worker source set successfully');
    }
    return sidebarPdfjsLib;
  } catch (error) {
    console.error('Error initializing Sidebar PDF.js:', error);
    throw error;
  }
};

export const loadSidebarPDF = async (pdfData: Uint8Array): Promise<PDFDocumentProxy> => {
  const lib = await initSidebarPDFJS();
  if (!lib) throw new Error('Sidebar PDF.js not initialized');

  if (!pdfData?.length) throw new Error('Invalid PDF data');

  try {
    const loadingTask = lib.getDocument(new Uint8Array(pdfData));
    loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      console.log(`Loading Sidebar PDF: ${Math.round((loaded / total) * 100)}%`);
    };
    return await loadingTask.promise;
  } catch (error) {
    console.error('Error loading sidebar PDF:', error);
    throw error;
  }
};

export const renderSidebarPage = async (
  page: PDFPageProxy,
  scale: number = 1.0
): Promise<HTMLCanvasElement> => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error('Could not get canvas context');

  // Set canvas dimensions
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Render PDF page to canvas
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas;
};

export const renderSidebarPageWithTextLayer = async (
  page: PDFPageProxy,
  container: HTMLElement,
  scale: number = 1
): Promise<void> => {
  // Create a unique session ID for logging/debugging this specific render call
  const sessionId = `pdf_render_${page.pageNumber}_${Date.now().toString().slice(-6)}`;
  console.log(`[${sessionId}] 🔍 Starting sidebar PDF page ${page.pageNumber} render at scale ${scale}`);
  
  try {
    // Step 1: Initialize PDF.js library
    const lib = await initSidebarPDFJS();
    if (!lib) {
      console.error(`[${sessionId}] ❌ PDF.js library not available for sidebar`);
      return;
    }
    
    // Step 2: Get viewport and clear container
    const viewport = page.getViewport({ scale });
    console.log(`[${sessionId}] 📐 Page viewport size: ${viewport.width}x${viewport.height}`);
    
    // Step 3: Clear the container completely
    container.innerHTML = '';
    container.style.position = 'relative'; // Ensure proper positioning
    container.style.width = `${viewport.width}px`;
    container.style.height = `${viewport.height}px`;
    console.log(`[${sessionId}] 🧹 Container cleared and sized`);
    
    // Step 4: Create new canvas with guaranteed unique ID
    const canvas = document.createElement('canvas');
    canvas.id = `pdf-canvas-${sessionId}`;
    canvas.className = 'pdf-canvas';
    canvas.style.display = 'block'; // Ensure canvas is visible
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.backgroundColor = '#ffffff';
    container.appendChild(canvas);
    console.log(`[${sessionId}] 🎨 Canvas created with ID: ${canvas.id}`);
    
    // Step 5: Set canvas dimensions explicitly
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    
    // Step 6: Get rendering context
    const context = canvas.getContext('2d');
    if (!context) {
      console.error(`[${sessionId}] ❌ Could not get 2D context from canvas`);
      return;
    }
    
    // Step 7: Clear the canvas with white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Step 8: Render the PDF page to canvas
    console.log(`[${sessionId}] 🖼️ Starting PDF page render to canvas`);
    const renderTask = page.render({
      canvasContext: context,
      viewport
    });
    
    // Step 9: Wait for render to complete
    await renderTask.promise;
    console.log(`[${sessionId}] ✅ PDF page ${page.pageNumber} rendered successfully`);
    
    // The text layer is temporarily disabled for simplicity
    // This ensures we can focus on just getting the basic PDF content visible
    
    // Verify canvas is still in DOM after render
    if (!document.getElementById(canvas.id)) {
      console.error(`[${sessionId}] ⚠️ Canvas was removed from DOM during render`);
    }
  } catch (err) {
    console.error(`[${sessionId}] ❌ Fatal error rendering PDF page ${page.pageNumber}:`, err);
  }
  
  // Final status log
  console.log(`[${sessionId}] 📋 Render process complete for page ${page.pageNumber}`);
};

export const getSidebarPageDimensions = (page: PDFPageProxy, scale: number = 1.0) => {
  const viewport = page.getViewport({ scale });
  return {
    width: viewport.width,
    height: viewport.height,
  };
};
