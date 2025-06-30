'use client';

import { type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

let pdfjsLib: typeof import('pdfjs-dist');

export const initPDFJS = async () => {
  if (typeof window === 'undefined') return null;

  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
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
  
  // Create canvas element
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');
  
  // Get page dimensions at the specified scale
  const viewport = page.getViewport({ scale });
  
  // Set canvas dimensions
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  
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
  container.appendChild(textLayerDiv);
  
  // Apply text layer styles
  const existingStyle = document.getElementById('pdf-text-layer-style');
  if (!existingStyle) {
    const style = document.createElement('style');
    style.id = 'pdf-text-layer-style'; // Add ID to prevent duplicates
    style.textContent = `
      .textLayer {
        opacity: 0.2;
        line-height: 1.0;
        user-select: text;
        pointer-events: auto; /* Enable text selection */
      }
      
      .textLayer > span {
        position: absolute;
        color: transparent;
        white-space: pre;
        cursor: text;
        transform-origin: 0% 0%;
      }
      
      .textLayer .highlight {
        background-color: rgba(180, 0, 170, 0.2);
      }
      
      .textLayer ::selection { 
        background: rgba(0, 0, 255, 0.3); 
      }
    `;
    document.head.appendChild(style);
  }
  
  try {
    // Render page to canvas
    await page.render({
      canvasContext: context,
      viewport
    }).promise;
    
    // Get text content from page
    const textContent = await page.getTextContent();
    
    // Iterate through each text item
    textContent.items.forEach((textItem: any) => {
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
      
      // Calculate position on canvas
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
      const fontSize = itemHeight * scaleValue;
      
      // Create text span
      const textSpan = document.createElement('span');
      textSpan.textContent = textItem.str;
      textSpan.style.position = 'absolute';
      textSpan.style.left = `${tx}px`;
      textSpan.style.top = `${ty}px`;
      textSpan.style.fontSize = `${fontSize}px`;
      textSpan.style.fontFamily = fontStyle?.fontFamily || 'sans-serif';
      textSpan.style.transform = `scaleX(${itemWidth / (textItem.str.length || 1) / (itemHeight || 1)})`;
      textSpan.style.transformOrigin = 'left';
      
      // Add to container
      textLayerDiv.appendChild(textSpan);
    });
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
