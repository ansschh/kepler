'use client';

import { type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

let pdfjsLib: typeof import('pdfjs-dist');

export const initPDFJS = async () => {
  if (typeof window === 'undefined') return null;

  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.js';
    }
  }
  return pdfjsLib;
};

export const loadPDF = async (pdfData: Uint8Array): Promise<PDFDocumentProxy> => {
  const lib = await initPDFJS();
  if (!lib) throw new Error('PDF.js not initialized');

  if (!pdfData?.length) throw new Error('Invalid PDF data');

  try {
    const loadingTask = lib.getDocument(new Uint8Array(pdfData));
    loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      console.log(`Loading PDF: ${Math.round((loaded / total) * 100)}%`);
    };
    return await loadingTask.promise;
  } catch (error) {
    console.error('Error loading PDF:', error);
    throw error;
  }
};

export const renderPage = async (
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

  try {
    // Render page
    await page.render({
      canvasContext: context,
      viewport
    }).promise;

    return canvas;
  } catch (error) {
    console.error('Error rendering page:', error);
    throw error;
  }
};

export async function renderPageWithTextLayer(
  page: PDFPageProxy,
  container: HTMLElement,
  scale: number = 1.0
): Promise<void> {
  // Clear any existing content
  container.innerHTML = '';
  
  // Account for device pixel ratio for high-DPI displays
  // Use a higher pixel ratio for ultra-crisp text at any zoom level
  const pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
  
  // Create canvas element
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: true }); // Set alpha to true to allow transparency
  if (!context) throw new Error('Could not get canvas context');
  
  // Get page dimensions at the specified scale
  const viewport = page.getViewport({ scale });
  
  // Set canvas dimensions accounting for device pixel ratio
  const scaledWidth = Math.floor(viewport.width * pixelRatio);
  const scaledHeight = Math.floor(viewport.height * pixelRatio);
  canvas.width = scaledWidth;
  canvas.height = scaledHeight;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  
  // Set CSS for sharper text rendering
  canvas.style.imageRendering = 'high-quality';
  
  // Add page class for easier selection and targeting
  canvas.className = 'pdf-page';
  
  // Apply high-quality scaling and rendering hints
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  
  // Scale context based on pixel ratio for ultra-sharp rendering
  context.scale(pixelRatio, pixelRatio);
  
  // Append canvas to container
  container.appendChild(canvas);
  
  // Create and append text layer div
  const textLayerDiv = document.createElement('div');
  textLayerDiv.className = 'textLayer';
  textLayerDiv.style.position = 'absolute';
  textLayerDiv.style.top = '0';
  textLayerDiv.style.left = '0';
  textLayerDiv.style.width = `${viewport.width}px`;
  textLayerDiv.style.height = `${viewport.height}px`;
  textLayerDiv.style.pointerEvents = 'none'; // Initially disable pointer events
  container.appendChild(textLayerDiv);
  
  // Apply text layer styles
  const existingStyle = document.getElementById('pdf-text-layer-style');
  if (!existingStyle) {
    const style = document.createElement('style');
    style.id = 'pdf-text-layer-style'; // Add ID to prevent duplicates
    style.textContent = `
      .textLayer {
        position: absolute;
        inset: 0;
        opacity: 0.25;
        line-height: 1.0;
        user-select: text;
        pointer-events: auto; /* Enable text selection */
        overflow: hidden;
        mix-blend-mode: multiply;
      }
      
      .textLayer > span {
        position: absolute;
        color: transparent;
        white-space: pre;
        cursor: text;
        transform-origin: 0% 0%;
      }

      /* Hide page number overlays */
      .textLayer > span:only-child,
      .textLayer > span[style*="top: 0"] {
        display: none;
      }
      
      .textLayer .highlight {
        background-color: rgba(180, 0, 170, 0.3);
      }
      
      .textLayer ::selection { 
        background: rgba(0, 0, 255, 0.3); 
      }
      
      /* Ensure canvas renders crisply */
      canvas.pdf-page {
        display: block;
        image-rendering: high-quality;
        text-rendering: geometricPrecision;
      }
    `;
    document.head.appendChild(style);
  }
  
  try {
    // Fill with white background to prevent black areas
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width / pixelRatio, canvas.height / pixelRatio);
    
    // Render page to canvas with high quality settings
    await page.render({
      canvasContext: context,
      viewport,
      // Use only supported options
      intent: 'display'
    }).promise;
    
    // Get text content from page
    const textContent = await page.getTextContent();
    
    // Filter and iterate through text items
    const filteredItems = textContent.items.filter((textItem: any) => {
      const text = textItem.str?.trim();
      // Filter out standalone page numbers and 'Page X' text
      return !(/^Page\s+\d+$|^\d+$/.test(text));
    });

    // Wait for canvas rendering to complete before adding text layer
    setTimeout(() => {
      // Now enable pointer events for text selection
      textLayerDiv.style.pointerEvents = 'auto';
      
      filteredItems.forEach((textItem: any) => {
        // Skip empty text items
        if (!textItem.str || textItem.str.trim() === '') return;
        
        // Extract position from the transform matrix safely
        // PDF.js transform is typically a 6-element array [a, b, c, d, e, f] where e,f are translation
        const transform = textItem.transform as unknown as number[];
        // We need to safely extract the values at positions 4 and 5 (the translation components)
        const itemX = Array.isArray(transform) && transform.length >= 5 ? transform[4] : 0;
        const itemY = Array.isArray(transform) && transform.length >= 6 ? transform[5] : 0;
        const itemWidth = textItem.width;
        const itemHeight = textItem.height;

        // Apply viewport transform
        const scaleValue = viewport.scale;
        const rotation = viewport.rotation;
        
        // Calculate position on canvas - more accurate positioning
        let tx, ty;
        if (rotation === 0) {
          tx = itemX * scaleValue;
          ty = (viewport.height / scaleValue - itemY) * scaleValue; // Flip Y coordinates
        } else {
          // Handle different rotations if needed
          tx = itemX * scaleValue;
          ty = (viewport.height / scaleValue - itemY) * scaleValue;
        }

        const fontStyle = textContent.styles[textItem.fontName];
        const fontSize = Math.max(1, itemHeight * scaleValue); // Ensure minimum font size
        
        // Create text span with improved positioning
        const textSpan = document.createElement('span');
        textSpan.textContent = textItem.str;
        textSpan.style.position = 'absolute';
        textSpan.style.left = `${tx}px`;
        textSpan.style.top = `${ty - fontSize}px`; // Adjust vertical position for better alignment
        textSpan.style.height = `${fontSize}px`;
        textSpan.style.fontSize = `${fontSize}px`;
        textSpan.style.fontFamily = fontStyle?.fontFamily || 'sans-serif';
        
        // Improved text scaling for better selection
        if (textItem.str.length > 0 && itemWidth > 0) {
          const scaleFactor = itemWidth / (textItem.str.length * fontSize * 0.5);
          textSpan.style.transform = `scaleX(${scaleFactor})`;
          textSpan.style.transformOrigin = 'left center';
        }
        
        // Add to container
        textLayerDiv.appendChild(textSpan);
      });
    }, 50); // Small delay to ensure canvas is fully rendered
  } catch (error) {
    console.error('Error rendering page with text layer:', error);
    throw error;
  }
}

export const getPageDimensions = (page: PDFPageProxy, scale: number = 1.0) => {
  const viewport = page.getViewport({ scale });
  return {
    width: viewport.width,
    height: viewport.height
  };
};
