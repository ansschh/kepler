"use client";

import React, { useState, useCallback } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronRight, ChevronDown, FileText, Folder, PlusCircle, Upload, File, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

export interface FileNode {
  storage_path: any;
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  parent_id: string | null;
  size_bytes?: number | null;
  content_type?: string | null;
  extension?: string | null;
}

interface FileNodeProps {
  file: FileNode;
  onFileSelect: (file: FileNode) => void;
  selectedFileId?: string;
  depth?: number;
  onDrop?: (targetId: string, sourceId: string) => void;
  onDragStart?: (file: FileNode) => void;
}

interface FileTreeProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  selectedFileId?: string;
  onMoveFile?: (sourceId: string, targetId: string) => Promise<boolean>;
}

export function FileTree({ files, onFileSelect, selectedFileId, onMoveFile }: FileTreeProps) {
  const { toast } = useToast();
  const [draggingFile, setDraggingFile] = useState<FileNode | null>(null);
  
  const handleDrop = async (targetId: string, sourceId: string) => {
    if (onMoveFile) {
      try {
        // Show loading toast
        toast({
          title: "Moving file",
          description: `Moving ${draggingFile?.name || 'file'}...`,
        });
        
        const success = await onMoveFile(sourceId, targetId);
        if (success) {
          toast({
            title: "Success",
            description: `Moved ${draggingFile?.name || 'file'} successfully`,
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to move file",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error moving file:', error);
        toast({
          title: "Error",
          description: `Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive"
        });
      }
    }
  };
  
  const handleDragStart = (file: FileNode) => {
    setDraggingFile(file);
  };
  
  return (
    <div className="space-y-1">
      {files.map(file => (
        <FileNode 
          key={file.id} 
          file={file} 
          onFileSelect={onFileSelect}
          selectedFileId={selectedFileId}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
        />
      ))}
    </div>
  );
}

export function FileNode({ file, onFileSelect, selectedFileId, depth = 0, onDrop, onDragStart }: FileNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();

  const toggleExpand = useCallback(() => {
    if (file.type === 'directory') {
      setExpanded(prev => !prev);
    }
  }, [file]);

  // Determine file icon based on type or extension
  const getFileIcon = () => {
    if (file.type === 'directory') {
      return expanded ? <FolderOpen className="h-4 w-4 mr-2" /> : <Folder className="h-4 w-4 mr-2" />;
    } 
    
    if (file.extension === 'tex') {
      return <FileText className="h-4 w-4 mr-2" />;
    }
    
    return <File className="h-4 w-4 mr-2" />;
  };
  
  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/filenode', file.id);
    e.dataTransfer.setData('text/plain', file.name);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(file);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only allow drops on directories or the root level
    if (file.type === 'directory') {
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };
  
  const handleDragLeave = () => {
    setIsDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    // Only allow drops on directories
    if (file.type !== 'directory') return;
    
    const sourceId = e.dataTransfer.getData('application/filenode');
    // Don't allow dropping onto itself or dropping a folder into its own child
    if (sourceId && sourceId !== file.id && onDrop) {
      onDrop(file.id, sourceId);
    }
  };

  return (
    <div>
      <div 
        className={cn(
          "flex items-center py-1 px-2 rounded-md", 
          isDragOver ? "bg-blue-100" : "",
          file.id === selectedFileId ? "bg-accent/50" : "hover:bg-accent/20",
          "cursor-pointer"
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => file.type === 'file' ? onFileSelect(file) : toggleExpand()}
        draggable={true}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {getFileIcon()}
        <span className="text-sm">{file.name}</span>
      </div>
      {file.type === 'directory' && expanded && file.children && file.children.map(child => (
        <FileNode 
          key={child.id} 
          file={child} 
          onFileSelect={onFileSelect} 
          selectedFileId={selectedFileId}
          depth={depth + 1}
          onDrop={onDrop}
          onDragStart={onDragStart}
        />
      ))}
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
