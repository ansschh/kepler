"use client";

import React, { useState, useCallback } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronRight, ChevronDown, FileText, Folder, PlusCircle, Upload, File } from 'lucide-react';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string; // Optional file extension
}

interface FileNodeProps {
  file: FileNode;
  onFileSelect: (file: FileNode) => void;
  selectedFileId?: string;
  depth?: number;
}

interface FileTreeProps {
  files: FileNode[];
  onFileSelect?: (file: FileNode) => void;
  onUploadClick?: (files?: FileList) => void;
  onCreateFileClick?: () => void;
  selectedFileId?: string;
}

export function FileTree({ files, onFileSelect, onUploadClick, onCreateFileClick, selectedFileId }: FileTreeProps) {
  // Pass the entire file node to the onFileSelect callback
  const handleFileSelect = (file: FileNode) => {
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  return (
    <div className="space-y-1">
      {files.map((file) => (
        <FileNode 
          key={file.id} 
          file={file} 
          onFileSelect={handleFileSelect} 
          selectedFileId={selectedFileId}
        />
      ))}
    </div>
  );
}

// Component to render a single file node
export function FileNode({ file, onFileSelect, selectedFileId, depth = 0 }: FileNodeProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  const renderFileIcon = useCallback((node: FileNode) => {
    if (node.type === 'directory') {
      return <Folder className="h-4 w-4 text-blue-500" />;
    }
    
    // Determine icon based on file extension
    switch(node.extension) {
      case 'tex':
      case 'latex':
        return <FileText className="h-4 w-4 text-orange-500" />;
      case 'pdf':
        return <File className="h-4 w-4 text-red-500" />;
      case 'bib':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
        return <File className="h-4 w-4 text-purple-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  }, []);

  return (
    <div>
      <div 
        className={`flex items-center py-1 px-2 rounded-md ${file.id === selectedFileId ? 'bg-accent/50' : 'hover:bg-accent/20'} cursor-pointer`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => file.type === 'file' ? onFileSelect(file) : toggleExpand()}
      >
        {file.type === 'directory' && (
          <span className="mr-1" onClick={(e) => {
            e.stopPropagation();
            toggleExpand();
          }}>
            {expanded ? 
              <ChevronDown className="h-4 w-4 text-muted-foreground" /> : 
              <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </span>
        )}
        <span className="mr-2">{renderFileIcon(file)}</span>
        <span className="text-sm truncate">{file.name}</span>
      </div>

      {file.type === 'directory' && expanded && file.children && (
        <div>
          {file.children.map(childNode => (
            <FileNode 
              key={childNode.id} 
              file={childNode} 
              onFileSelect={onFileSelect} 
              selectedFileId={selectedFileId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileUploadModal({
  isOpen,
  onClose,
  onUploadClick
}: {
  isOpen: boolean;
  onClose: () => void;
  onUploadClick: () => void;
}) {
  if (!isOpen) return null;
  
  const handleUploadClick = () => {
    if (onUploadClick) {
      onUploadClick();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-lg p-6 w-80">
        <h3 className="font-medium mb-4">Upload Files</h3>
        <div className="space-y-4">
          <Button 
            className="w-full" 
            variant="outline"
            onClick={handleUploadClick}
          >
            Select Files
          </Button>
        </div>
      </div>
    </div>
  );
}
