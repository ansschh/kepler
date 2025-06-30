"use client";

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileNode, FileTree } from '@/components/file-tree';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Upload, FileText, FilePlus, FileUp, PlusCircle, FolderPlus, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LeftSidebarProps {
  files: FileNode[];
  documentContent?: string;
  onFileSelect?: (file: FileNode) => void;
  onUploadFiles?: (files: FileList) => void;
  onCreateFile?: () => void;
  selectedFileId?: string;
  onOutlineItemClick?: (line: number) => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export function LeftSidebar({
  files,
  documentContent,
  onFileSelect,
  onOutlineItemClick,
  onUploadFiles,
  onCreateFile,
  selectedFileId,
  className = '',
  collapsed: propCollapsed,
  onToggleCollapse
}: LeftSidebarProps) {
  const [stateCollapsed, setStateCollapsed] = useState(false);
  
  // Use either prop-controlled or internal state for collapsed state
  const collapsed = propCollapsed !== undefined ? propCollapsed : stateCollapsed;
  
  const setCollapsed = (value: boolean) => {
    if (onToggleCollapse) {
      onToggleCollapse(value);
    } else {
      setStateCollapsed(value);
    }
  };

  // Function to parse the outline of the document
  const getOutline = (content: string): { title: string; line: number }[] => {
    if (!content) return [];
    
    // Very simple section detection for demo purposes
    const sections: { title: string; line: number }[] = [];
    const lines = content.split('\n');
    const sectionRegex = /\\(chapter|section|subsection|subsubsection)\{(.+?)\}/g;
    
    let lineNumber = 1;
    for (const line of lines) {
      let match;
      while ((match = sectionRegex.exec(line)) !== null) {
        const [, level, title] = match;
        sections.push({ title: `${level}: ${title}`, line: lineNumber });
      }
      lineNumber++;
    }
    
    return sections;
  };

  const outline = getOutline(documentContent || '');

  // This will handle sidebar collapse/expand
  const toggleSidebar = () => {
    if (onToggleCollapse) {
      onToggleCollapse(!collapsed);
    }
  };
  
  // File action states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFileNameModalOpen, setIsFileNameModalOpen] = useState(false);
  const [isFolderNameModalOpen, setIsFolderNameModalOpen] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState('tex');
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Close modals
  const closeUploadModal = () => setIsUploadModalOpen(false);
  const closeFileNameModal = useCallback(() => {
    setIsFileNameModalOpen(false);
    setNewFileName('');
    setSelectedFileType('tex');
  }, []);
  
  const openFolderModal = useCallback(() => {
    setIsFolderNameModalOpen(true);
  }, []);
  
  const closeFolderModal = useCallback(() => {
    setIsFolderNameModalOpen(false);
    setNewFolderName('');
  }, []);

  // File upload handler
  const handleUpload = (files: FileList) => {
    if (onUploadFiles) {
      onUploadFiles(files);
    }
    closeUploadModal();
  };
  
  // Trigger file input click
  const triggerFileUpload = () => {
    setIsUploadModalOpen(true);
  };
  
  // Create new file handler
  const handleCreateFile = useCallback(() => {
    setIsFileNameModalOpen(true);
  }, []);
  
  // Create new folder handler
  const handleCreateFolder = useCallback(() => {
    if (newFolderName) {
      // Logic to create folder would go here
      console.log('Creating folder:', newFolderName);
      closeFolderModal();
    }
  }, [newFolderName, closeFolderModal]);
  
  // Submit new file creation
  const submitCreateFile = useCallback(() => {
    if (newFileName.trim() && onCreateFile) {
      // Here we would normally pass the file name and type to the handler
      // For now just calling the basic handler
      onCreateFile();
      setIsFileNameModalOpen(false);
    }
  }, [newFileName, onCreateFile]);
  
  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onUploadFiles) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  // Create a wrapper function to handle file selection
  const handleFileSelect = useCallback((file: FileNode) => {
    if (file) {
      onFileSelect?.(file); // Pass the entire file node
    }
  }, [onFileSelect]);

  // Handle file upload with type safety
  const handleUploadFiles = useCallback((files?: FileList) => {
    if (files && files.length > 0) {
      onUploadFiles?.(files);
    }
  }, [onUploadFiles]);

  // File tab container class based on drag state
  const fileTabContainerClass = `${isDragging ? 'bg-gray-100 border-2 border-dashed border-gray-400' : ''} transition-all duration-200 ease-in-out h-full`;

  if (collapsed) {
    return <div />;
  }

  return (
    <div className={`h-full flex flex-col overflow-hidden ${className}`}>
      <div className="flex-1 overflow-hidden h-full">
        <Tabs defaultValue="files" className="h-full flex flex-col">
          <div className="px-3 pt-3 pb-0">
            <TabsList className="grid w-full grid-cols-2 rounded-lg shadow-sm">
              <TabsTrigger value="files" className="rounded-l-lg py-1.5 px-2 text-center flex items-center justify-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span>Files</span>
              </TabsTrigger>
              <TabsTrigger value="outline" className="rounded-r-lg py-1.5 px-2 text-center flex items-center justify-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span>Outline</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="files" className="flex-1 overflow-hidden">
            <Card className="border-0 rounded-none h-full bg-transparent">
              <div className="border-y border-gray-200 dark:border-gray-700 px-3 py-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    <Button onClick={triggerFileUpload} size="icon" variant="ghost" className="h-7 w-7" title="Upload files">
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                    <Button onClick={handleCreateFile} size="icon" variant="ghost" className="h-7 w-7" title="Create new file">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button onClick={() => openFolderModal()} size="icon" variant="ghost" className="h-7 w-7" title="Create new folder">
                      <FolderPlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Search files">
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <CardContent 
                className={`pt-0 p-0 px-3 h-full flex flex-col ${fileTabContainerClass}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <ScrollArea className="flex-1 pb-4">
                  <FileTree 
                    files={files} 
                    onFileSelect={handleFileSelect} 
                    onUploadClick={triggerFileUpload} 
                    onCreateFileClick={handleCreateFile}
                    selectedFileId={selectedFileId}
                  />
                  {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10 rounded-md border border-dashed border-primary pointer-events-none">
                      <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg text-center">
                        <Upload className="h-12 w-12 text-primary animate-pulse" />
                        <p className="text-sm font-medium text-foreground">Drop files to upload</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files && handleUpload(e.target.files)}
                  multiple
                />
                
                {/* Upload Files Modal */}
                <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add files</DialogTitle>
                    </DialogHeader>
                    <div 
                      className="border-2 border-dashed rounded-md p-10 text-center hover:border-primary/50 transition-colors"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.files?.length && onUploadFiles) {
                          onUploadFiles(e.dataTransfer.files);
                          closeUploadModal();
                        }
                      }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <p className="text-base">Drop or paste your files, folder, or images here.</p>
                        <div className="mt-2">
                          <Button 
                            variant="link" 
                            className="text-blue-500 font-medium px-1 hover:underline" 
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Select files
                          </Button> or <Button variant="link" className="text-blue-500 font-medium px-1 hover:underline">select a folder</Button> from your computer.
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={closeUploadModal}>Cancel</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                {/* Create File Modal */}
                <Dialog open={isFileNameModalOpen} onOpenChange={setIsFileNameModalOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New File</DialogTitle>
                    </DialogHeader>
                    <div>
                      <Label htmlFor="filename">File Name</Label>
                      <Input
                        id="filename"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        placeholder="example.tex"
                        className="mt-1"
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label htmlFor="filetype">File Type</Label>
                      <Select value={selectedFileType} onValueChange={(value) => setSelectedFileType(value)}>
                        <SelectTrigger id="filetype" className="mt-1">
                          <SelectValue placeholder="Select file type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tex">TeX (.tex)</SelectItem>
                          <SelectItem value="bib">Bibliography (.bib)</SelectItem>
                          <SelectItem value="cls">Class (.cls)</SelectItem>
                          <SelectItem value="sty">Style (.sty)</SelectItem>
                          <SelectItem value="md">Markdown (.md)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={closeFileNameModal}>Cancel</Button>
                      <Button onClick={submitCreateFile}>Create</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="outline" className="flex-1 overflow-hidden">
            <Card className="border-0 rounded-none h-full bg-transparent">
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-sm font-medium">Document Outline</CardTitle>
              </CardHeader>
              <CardContent className="p-0 px-3">
                <ScrollArea className="h-[calc(100%-3rem)]">
                  {outline.length > 0 ? (
                    <ul className="space-y-1">
                      {outline.map((section, index) => (
                        <li key={index} className="hover:bg-muted px-2 py-1 rounded">
                          <button 
                            className="w-full text-left text-sm truncate"
                            onClick={() => onOutlineItemClick?.(section.line)}
                          >
                            {section.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-muted-foreground p-2">
                      No outline detected in document
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
