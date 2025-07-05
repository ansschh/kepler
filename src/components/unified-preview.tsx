"use client";

import React from 'react';
import { SidebarPDFView } from './sidebar-pdf-view';
import { CodePreview } from './code-preview';
import BinaryPreview from './binary-preview';
import { Card } from '@/components/ui/card';

interface UnifiedPreviewProps {
  file: {
    id: string;
    name: string;
    type: string;
    content?: string;
    content_type?: string;
    extension?: string;
  };
  filePath?: string;
  data: Uint8Array | string | null;
}

export function UnifiedPreview({ file, filePath, data }: UnifiedPreviewProps) {
  // Helper function to determine file type
  const getFileType = () => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (file.content_type === 'application/pdf' || extension === 'pdf') {
      return 'pdf';
    }
    
    if (file.content_type?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(extension)) {
      return 'image';
    }
    
    if (['py', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'json', 'md', 'txt'].includes(extension)) {
      return 'code';
    }
    
    return 'binary';
  };

  const fileType = getFileType();

  return (
    <Card className="w-full h-full overflow-hidden border-r-2 border-r-gray-300 shadow-md">
      {fileType === 'code' && (
        <CodePreview
          content={file.content || ''}
          language={file.extension || 'text'}
        />
      )}
      
      {fileType === 'pdf' && (
        <SidebarPDFView
          pdfData={data instanceof Uint8Array ? data : null}
          fileName={filePath ? filePath.split('/').pop() : undefined}
        />
      )}

      {fileType === 'image' && (
        <BinaryPreview
          fileType={file.content_type || 'image/*'}
          fileName={file.name}
          data={data}
        />
      )}
      
      {fileType === 'binary' && (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Binary file: {file.name}</p>
        </div>
      )}
    </Card>
  );
}
