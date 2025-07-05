"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UnifiedPreview } from '@/components/unified-preview';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileTree, FileNode as FileNodeType } from '@/components/file-tree';
import { createFile, getDocumentFiles, deleteFile, searchFiles } from '@/lib/file-operations';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Upload, FileText, FilePlus, FileUp, PlusCircle, FolderPlus, Search, X, File, Folder } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LeftSidebarProps {
  documentId: string;
  files?: FileNodeType[];
  documentContent?: string;
  onFileSelect?: (file: FileNodeType) => void;
  onUploadFiles?: (files: FileList) => void;
  onCreateFile?: (fileName: string, fileType: string) => void;
  selectedFileId?: string;
  onOutlineItemClick?: (line: number) => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
  refreshFiles?: () => Promise<void>;
  selectedFileData?: Uint8Array | string | null;
}

export function LeftSidebar({
  documentId,
  files: initialFiles,
  documentContent,
  onFileSelect,
  onOutlineItemClick,
  onUploadFiles,
  onCreateFile,
  selectedFileId,
  className = '',
  collapsed: propCollapsed,
  onToggleCollapse,
  refreshFiles,
  selectedFileData
}: LeftSidebarProps) {
  const { toast } = useToast();
  const [stateCollapsed, setStateCollapsed] = useState(false);
  const [files, setFiles] = useState<FileNodeType[]>(initialFiles || []);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
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
  
  // Helper function to debounce search input
  const debounce = <F extends (...args: any[]) => any>(func: F, delay: number) => {
    let debounceTimer: NodeJS.Timeout;
    return (...args: Parameters<F>) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => func(...args), delay);
    };
  };

  // This will handle sidebar collapse/expand
  const toggleSidebar = () => {
    if (onToggleCollapse) {
      onToggleCollapse(!collapsed);
    }
  };
  
  // Update files state when initialFiles prop changes
  useEffect(() => {
    if (initialFiles) {
      console.log('LeftSidebar: Received new files from props:', initialFiles.length);
      setFiles(initialFiles);
    }
  }, [initialFiles]);

  // Load the files when the component mounts or document ID changes
  useEffect(() => {
    const loadFiles = async () => {
      if (documentId && !initialFiles) {
        // Only load files if they weren't provided as props
        setIsLoading(true);
        try {
          console.log('LeftSidebar: Loading files from database...');
          const documentFiles = await getDocumentFiles(documentId);
          setFiles(documentFiles || []);
        } catch (error) {
          console.error('Error loading files:', error);
          toast({
            title: "Error",
            description: "Failed to load files",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      } else if (initialFiles) {
        setIsLoading(false);
      }
    };
    
    loadFiles();
  }, [documentId, toast, initialFiles]);
  
  // The handleFileSelect function is defined below at line ~370

  // Create a wrapper function to handle file selection
  const handleFileSelect = useCallback((file: FileNodeType) => {
    if (file) {
      console.log('File selected in sidebar:', file.name, file.id);
      
      // Pass the file to the parent component via the callback
      onFileSelect?.(file);
      
      // Show a toast notification for user feedback
      if (file.type === 'file') {
        toast({
          title: "File selected",
          description: `${file.name}`,
          duration: 1500
        });
      }
    }
  }, [onFileSelect, toast]);

  // Handle moving files between folders via drag and drop
  const handleMoveFile = useCallback(async (sourceId: string, targetId: string) => {
    if (!documentId) return false;
    
    try {
      // Get the source and target file details
      const { data: sourceFile } = await supabase
        .from('project_files')
        .select('*')
        .eq('id', sourceId)
        .single();
      
      const { data: targetFile } = await supabase
        .from('project_files')
        .select('*')
        .eq('id', targetId)
        .single();
      
      if (!sourceFile || !targetFile || targetFile.type !== 'directory') {
        console.error('Invalid source or target file');
        return false;
      }
      
      // Update the parent_id of the source file to the target file's id
      const { error: updateError } = await supabase
        .from('project_files')
        .update({ 
          parent_id: targetId,
          updated_at: new Date().toISOString()
        })
        .eq('id', sourceId);
      
      if (updateError) {
        console.error('Error updating file parent:', updateError);
        return false;
      }
      
      // Refresh the file list
      const updatedFiles = await getDocumentFiles(documentId);
      setFiles(updatedFiles || []);
      
      // Show success notification
      toast({
        title: "File moved",
        description: `Moved ${sourceFile.name} to ${targetFile.name}`,
        duration: 2000
      });
      
      return true;
    } catch (error) {
      console.error('Error moving file:', error);
      
      // Show error notification
      toast({
        title: "Error moving file",
        description: "Failed to move file. Please try again.",
        variant: "destructive"
      });
      
      return false;
    }
  }, [documentId, toast]);
  
  // File action states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFileNameModalOpen, setIsFileNameModalOpen] = useState(false);
  const [isFolderNameModalOpen, setIsFolderNameModalOpen] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState('tex');
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modal close handlers
  const closeUploadModal = useCallback(() => {
    setIsUploadModalOpen(false);
  }, []);
  
  const closeFileNameModal = useCallback(() => {
    setIsFileNameModalOpen(false);
    setNewFileName('');
    setSelectedFileType('tex'); // Reset to default
  }, []);
  
  const closeFolderModal = useCallback(() => {
    setIsFolderNameModalOpen(false);
    setNewFolderName('');
  }, []);
  
  const openFolderModal = useCallback(() => {
    setNewFolderName('');
    setIsFolderNameModalOpen(true);
  }, []);
  
  // File upload handler
  const handleUpload = useCallback((files: FileList) => {
    if (files && files.length > 0) {
      // Pass to the parent handler if provided
      if (onUploadFiles) {
        onUploadFiles(files);
      }
      closeUploadModal();
    }
  }, [onUploadFiles, closeUploadModal]);

  // Trigger file input click
  const triggerFileUpload = () => {
    setIsUploadModalOpen(true);
  };
  
  // Create new file handler
  const handleCreateFile = useCallback(() => {
    setNewFileName('');
    setSelectedFileType('tex');
    setIsFileNameModalOpen(true);
  }, []);
  
  // Create new folder handler
  const handleCreateFolder = useCallback(async () => {
    if (newFolderName.trim() && documentId) {
      try {
        console.log('Creating folder:', newFolderName);
        // Use correct parameter order for the updated createFile function
        const newFolder = await createFile(
          documentId,
          newFolderName,
          'directory',
          null, // parent_id - null for root level
          null, // No content for directories
          null, // No extension for directories
          null, // No binary content for directories
          'application/directory' // Content type for directories
        );
        
        if (newFolder) {
          console.log('Folder created successfully:', newFolder);
          // Refresh the file list
          const updatedFiles = await getDocumentFiles(documentId);
          setFiles(updatedFiles);
          
          // Show success toast
          toast({
            title: "Folder created",
            description: `Created folder: ${newFolderName}`,
          });
        } else {
          console.error('Failed to create folder - returned null');
          toast({
            title: "Error",
            description: "Could not create folder",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error creating folder:', error);
        toast({
          title: "Error",
          description: `Could not create folder: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive"
        });
      }
      closeFolderModal();
    } else {
      if (!newFolderName.trim()) {
        toast({
          title: "Validation error",
          description: "Folder name cannot be empty",
          variant: "destructive"
        });
      }
      console.warn('Cannot create folder: empty folder name or missing document ID');
    }
  }, [newFolderName, closeFolderModal, documentId, toast]);
  
  // Submit new file creation
  const submitCreateFile = useCallback(async () => {
    if (newFileName.trim() && documentId) {
      try {
        // Create the file in the database
        const fileName = newFileName.includes('.') ? newFileName : `${newFileName}.${selectedFileType}`;
        const extension = fileName.split('.').pop() || selectedFileType;
        
        // Use correct parameter order for updated createFile function
        const newFile = await createFile(
          documentId,
          fileName,
          'file',
          null, // parent_id - null for root level
          '', // Empty content
          extension, // File extension
          null, // No binary content for new text file
          null // Content type will be auto-detected
        );
        
        if (newFile) {
          // Refresh the file list
          const updatedFiles = await getDocumentFiles(documentId);
          setFiles(updatedFiles);
          
          // Call the parent handler if provided
          if (onCreateFile) {
            onCreateFile(fileName, extension);
          }
          
          // Select the newly created file
          handleFileSelect(newFile);
          
          // Show success toast
          toast({
            title: "File created",
            description: `Created ${fileName}`,
          });
        } else {
          toast({
            title: "Error",
            description: "Could not create file",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error creating file:', error);
        toast({
          title: "Error",
          description: `Could not create file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          variant: "destructive"
        });
      }
      closeFileNameModal();
    } else {
      if (!newFileName.trim()) {
        toast({
          title: "Validation error",
          description: "File name cannot be empty",
          variant: "destructive"
        });
      }
    }
  }, [newFileName, selectedFileType, documentId, onCreateFile, closeFileNameModal, handleFileSelect, toast]);
  
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
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };



  // Search for files with debouncing
  const handleSearch = useCallback(
    debounce(async (term: string) => {
      if (documentId) {
        try {
          setIsLoading(true);
          if (term.trim()) {
            const results = await searchFiles(documentId, term);
            setFiles(results);
          } else {
            // If search cleared, reload full tree
            const updatedFiles = await getDocumentFiles(documentId);
            setFiles(updatedFiles);
          }
        } catch (error) {
          console.error('Error searching files:', error);
          toast({
            title: "Search error",
            description: "Failed to search files",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      }
    }, 300),
    [documentId, toast]
  );

  // Handle file upload with type safety
  const handleUploadFiles = useCallback(async (fileList?: FileList) => {
    if (fileList && fileList.length > 0 && documentId) {
      // Only call the parent handler if provided
      if (onUploadFiles) {
        // Show uploading toast
        toast({
          title: "Uploading files",
          description: `Uploading ${fileList.length} file${fileList.length > 1 ? 's' : ''}...`,
        });
        
        // Let the parent component handle the actual upload
        onUploadFiles(fileList);
        
        // Manually refresh files after a short delay to ensure upload is complete
        setTimeout(async () => {
          if (refreshFiles) {
            await refreshFiles();
          } else {
            // Fallback: refresh files directly if no refreshFiles prop is provided
            const updatedFiles = await getDocumentFiles(documentId);
            setFiles(updatedFiles);
          }
        }, 500); // Small delay to ensure upload completes
      } else {
        console.warn('No upload handler provided to LeftSidebar');
      }
    }
  }, [onUploadFiles, documentId, toast, refreshFiles]);

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
                  <div className="relative">
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search files..."
                      className="h-7 w-32 text-xs"
                      value={searchTerm}
                      onChange={(e) => {
                        const term = e.target.value;
                        setSearchTerm(term);
                        handleSearch(term);
                      }}
                    />
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7 absolute right-0 top-0"
                      onClick={() => {
                        if (searchTerm) {
                          setSearchTerm('');
                          // Reset search and reload files
                          getDocumentFiles(documentId).then(setFiles);
                        } else {
                          // Focus the search input
                          searchInputRef.current?.focus();
                        }
                      }}
                    >
                      {searchTerm ? (
                        <X className="h-3.5 w-3.5" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <CardContent 
                className={`pt-0 p-0 px-3 h-full flex flex-col ${fileTabContainerClass}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <ScrollArea className="flex-1 pb-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-sm text-muted-foreground">Loading files...</div>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-2">
                      <div className="text-sm text-muted-foreground">No files found</div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-xs" 
                        onClick={handleCreateFile}
                      >
                        Create your first file
                      </Button>
                    </div>
                  ) : (
                    <FileTree 
                      files={files} 
                      onFileSelect={handleFileSelect}
                      selectedFileId={selectedFileId}
                      onMoveFile={handleMoveFile}
                    />
                  )}
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
                  onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
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
                        if (e.dataTransfer.files?.length) {
                          handleUploadFiles(e.dataTransfer.files);
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            submitCreateFile();
                          }
                        }}
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
                
                {/* Create Folder Modal */}
                <Dialog open={isFolderNameModalOpen} onOpenChange={setIsFolderNameModalOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Folder</DialogTitle>
                    </DialogHeader>
                    <div>
                      <Label htmlFor="foldername">Folder Name</Label>
                      <Input
                        id="foldername"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="New Folder"
                        className="mt-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateFolder();
                          }
                        }}
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={closeFolderModal}>Cancel</Button>
                      <Button onClick={handleCreateFolder}>Create</Button>
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
