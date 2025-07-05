"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { SidebarPDFView } from './sidebar-pdf-view';
import { initPDFJS } from '@/lib/pdf';
import '@/styles/pdf-viewer.css';

interface BinaryPreviewProps {
  fileType: string;
  fileName: string;
  data: Uint8Array | string | null;
}

function arrayBufferToUint8Array(data: ArrayBuffer): Uint8Array {
  return new Uint8Array(data);
}

export default function BinaryPreview({ fileType, fileName, data }: BinaryPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const isImage = useMemo(() => 
    fileType.startsWith('image/') || 
    ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(
      fileName.split('.').pop()?.toLowerCase() || ''
    ),
    [fileType, fileName]
  );

  const isPDF = useMemo(() => 
    fileType === 'application/pdf' || 
    fileName.toLowerCase().endsWith('.pdf'),
    [fileType, fileName]
  );

  // Initialize PDF.js when component mounts
  useEffect(() => {
    if (isPDF && !isInitialized) {
      initPDFJS().then(() => setIsInitialized(true));
    }
  }, [isPDF, isInitialized]);

  useEffect(() => {
    if (!data) {
      setPdfData(null);
      return;
    }

    if (data instanceof Uint8Array) {
      setPdfData(data);
    } else if (typeof data === 'string') {
      try {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        setPdfData(bytes);
      } catch (err) {
        console.error('Error converting base64 to Uint8Array:', err);
        setError('Invalid PDF data format');
      }
    }
  }, [data]);

  const renderContent = () => {
    if (!data) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">No file selected</p>
        </div>
      );
    }

    if (isImage) {
      const imageUrl = data instanceof Uint8Array
        ? URL.createObjectURL(new Blob([data]))
        : `data:${fileType};base64,${data}`;

      return (
        <div className="flex items-center justify-center h-full">
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain"
            onLoad={() => URL.revokeObjectURL(imageUrl)}
          />
        </div>
      );
    }

    if (isPDF && pdfData) {
      if (!isInitialized) {
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Initializing PDF viewer...</p>
          </div>
        );
      }
      return <SidebarPDFView pdfData={pdfData} fileName={fileName} />;
    }

    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Preview not available for this file type</p>
      </div>
    );
  };

  return (
    <div className="h-full">
      {renderContent()}
    </div>
  );
}

