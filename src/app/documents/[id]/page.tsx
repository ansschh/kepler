"use client";

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LatexEditor } from "@/components/latex-editor";
import { PDFPreview } from "@/components/pdf-preview";
import { VersionHistory } from "@/components/version-history";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { FileNode } from '@/components/file-tree';
import { getDocumentFiles, createFile, getFileContent, updateFile } from '@/lib/file-operations';
import { Expand, Share2, X, ChevronRight, ChevronLeft, Menu, MenuSquare, History, ZoomIn, ZoomOut, Search } from 'lucide-react';
import { RealtimeService } from '@/lib/realtime';
import { Document } from '@/types/document';
import { supabase } from '@/lib/supabase';
import { compileLatex } from '@/lib/latex-compiler';
import { useParams } from 'next/navigation';
import { toast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShareModal } from '@/components/ui/share-modal';
import { AlertCircle } from 'lucide-react';
import BinaryPreview from '@/components/binary-preview';

export default function SharedDocument() {
  const params = useParams();
  const documentId = params.id as string;
  
  const [latex, setLatex] = useState('');
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null); // For compiled LaTeX PDF preview
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1);
  
  // Additional binary file states
  const [imageUrl, setImageUrl] = useState<string | null>(null); // For image preview
  const [selectedPdfData, setSelectedPdfData] = useState<Uint8Array | null>(null); // For PDF files selected from sidebar
  const [selectedFileType, setSelectedFileType] = useState<string>('text'); // Type of the selected file (text, pdf, image, etc)
  const [selectedFileName, setSelectedFileName] = useState<string>(''); // Name of the selected file
  
  // Track sidebar collapsed states
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(true); // Start with right sidebar collapsed
  
  // Track fullscreen and share modal states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  // Track compilation state and errors
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  
  // Files will be loaded from the database
  const [files, setFiles] = useState<FileNode[]>([]);
  
  // Currently selected file
  const [selectedFileId, setSelectedFileId] = useState('root-1'); // Default to main.tex

  // No duplicate variables here

  useEffect(() => {
    const loadDocument = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Redirect to sign in if not authenticated
          window.location.href = '/auth/sign-in';
          return;
        }

        // Load the document
        const doc = await RealtimeService.getDocument(documentId);
        if (!doc) {
          // Handle document not found
          console.error('Document not found');
          return;
        }
        
        setLatex(doc.content);
        
        // Load files from the database
        const documentFiles = await getDocumentFiles(documentId);
        setFiles(documentFiles);
        
        // If files exist, select the first .tex file, or the first file
        if (documentFiles.length > 0) {
          const texFile = documentFiles.find(file => 
            file.type === 'file' && file.extension === 'tex'
          );
          
          if (texFile) {
            setSelectedFileId(texFile.id);
          } else if (documentFiles[0].type === 'file') {
            setSelectedFileId(documentFiles[0].id);
          }
        } else {
          // Create a default main.tex file if no files exist
          const newFile = await createFile(
            documentId,
            'main.tex',
            'file',
            null,
            doc.content || '% New LaTeX document\n\n\\documentclass{article}\n\\begin{document}\n\\title{New Document}\n\\author{Author}\n\\maketitle\n\n\\section{Introduction}\n\nYour content here.\n\n\\end{document}',
            'tex'
          );
          
          if (newFile) {
            // Refresh files
            const updatedFiles = await getDocumentFiles(documentId);
            setFiles(updatedFiles);
            setSelectedFileId(newFile.id);
          }
        }
      } catch (error) {
        console.error('Error loading document:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [documentId]);

  // Helper function to determine if a file is binary based on extension
  const isBinaryFile = (filename: string): boolean => {
    const binaryExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'zip', 'docx', 'xlsx'];
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    return binaryExtensions.includes(extension);
  };

  // Handle file selection from file tree
  const handleFileSelect = useCallback(async (file: FileNode) => {
    console.log('Page.tsx - handleFileSelect called with file:', file.name, file.id, file.type);
    
    // Set the file as active using its ID and name
    if (file) {
      setSelectedFileId(file.id);
      setSelectedFileName(file.name);
      console.log('Updated selectedFileId to:', file.id);
      
      // Clear previous values
      setLatex("");
      setImageUrl("");
      setSelectedPdfData(null); // Clear any previously loaded PDF data
      
      // If it's a file (not a folder), load its content
      if (file.type === 'file') {
        try {
          const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
          const isBinary = isBinaryFile(file.name);
          
          console.log(`File extension: ${fileExtension}, Is binary file: ${isBinary}`);

          // Check if it's a binary file (has storage_path or has binary extension)
          if (file.storage_path || isBinary) {
            console.log('Handling binary file:', file.name);
            
            // Set file type based on extension
            if (fileExtension === 'pdf' || file.content_type === 'application/pdf') {
              setSelectedFileType('pdf');
            } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(fileExtension) || file.content_type?.startsWith('image/')) {
              setSelectedFileType('image');
            } else {
              setSelectedFileType('binary');
            }
            
            // Create a storage path if one doesn't exist
            // Make sure to handle special characters by creating a safe file path
            let storagePath = file.storage_path;
            if (!storagePath) {
              // If we're creating a path, make sure it's safe for storage
              const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
              storagePath = `${documentId}/${file.id}-${safeFileName}`;
            }
            console.log('Using storage path:', storagePath);
            
            try {
              console.log('Attempting to get public URL for file...');
              
              // Get a signed URL for the file - this works better with RLS policies
              const { data: urlData } = await supabase.storage
                .from('project-files')
                .createSignedUrl(storagePath, 3600); // 1 hour expiry
                
              if (urlData?.signedUrl) {
                console.log('Signed URL available:', urlData.signedUrl);
                
                // Try to fetch the file using the signed URL
                try {
                  console.log('Fetching file from signed URL');
                  const response = await fetch(urlData.signedUrl);
                  
                  if (response.ok) {
                    const blob = await response.blob();
                    console.log('Successfully fetched file via signed URL, size:', blob.size);
                    
                    // Process the blob data based on file type
                    if (fileExtension === 'pdf' || file.content_type === 'application/pdf') {
                      try {
                        console.log('Processing PDF from signed URL');
                        const arrayBuffer = await blob.arrayBuffer();
                        const uint8Array = new Uint8Array(arrayBuffer);
                        setSelectedPdfData(uint8Array);
                        setSelectedFileName(file.name);
                        setSelectedFileType('pdf');
                        return; // Exit early as we've handled the file
                      } catch (pdfErr) {
                        console.error('Error processing PDF from signed URL:', pdfErr);
                      }
                    } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(fileExtension) || 
                              (file.content_type && file.content_type.startsWith('image/'))) {
                      try {
                        console.log('Processing image from signed URL');
                        const objectUrl = URL.createObjectURL(blob);
                        setImageUrl(objectUrl);
                        setSelectedFileName(file.name);
                        setSelectedFileType('image');
                        return; // Exit early as we've handled the file
                      } catch (imgErr) {
                        console.error('Error processing image from public URL:', imgErr);
                      }
                    }
                  } else {
                    console.error('Failed to fetch from signed URL:', response.status, response.statusText);
                  }
                } catch (fetchErr) {
                  console.error('Error fetching from signed URL:', fetchErr);
                  // Fall back to direct download
                }
              }
              
              // Fall back to direct download if signed URL didn't work
              console.log('Attempting direct download from storage...');
              const { data: fileData, error } = await supabase.storage
                .from('project-files')
                .download(storagePath);
              
              if (error) {
                console.error('Error downloading file from storage:', error);
                toast({
                  title: "Error loading file",
                  description: `Failed to load ${file.name}. This may be a binary file that hasn't been uploaded properly.`,
                  variant: "destructive"
                });
                
                // Show placeholder message for binary files
                setSelectedFileName(file.name);
                return;
              }
              
              if (fileData) {
                console.log('Successfully loaded binary file data, type:', fileData.type, 'size:', fileData.size);
                
                // Handle different binary file types
                if (fileExtension === 'pdf' || file.content_type === 'application/pdf') {
                  try {
                    // For PDF, convert to ArrayBuffer and then Uint8Array for PDF.js
                    console.log('Processing PDF file');
                    const arrayBuffer = await fileData.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    console.log('PDF data prepared, length:', uint8Array.length);
                    setSelectedPdfData(uint8Array);
                    setSelectedFileName(file.name);
                    
                    // Ensure we set the correct file type
                    setSelectedFileType('pdf');
                    return;
                  } catch (pdfErr) {
                    console.error('Error processing PDF data:', pdfErr);
                    toast({
                      title: "Error processing PDF",
                      description: `Could not process ${file.name} as a PDF file.`,
                      variant: "destructive"
                    });
                  }
                } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(fileExtension) || 
                           (file.content_type && file.content_type.startsWith('image/'))) {
                  try {
                    // For images, create an object URL
                    console.log('Processing image file');
                    const objectUrl = URL.createObjectURL(fileData);
                    console.log('Image URL created');
                    setImageUrl(objectUrl);
                    setSelectedFileName(file.name);
                    
                    // Ensure we set the correct file type
                    setSelectedFileType('image');
                    return;
                  } catch (imgErr) {
                    console.error('Error processing image data:', imgErr);
                    toast({
                      title: "Error processing image",
                      description: `Could not process ${file.name} as an image file.`,
                      variant: "destructive"
                    });
                  }
                } else {
                  // Other binary files - show placeholder
                  console.log('Unknown binary file type');
                  setSelectedFileName(file.name);
                  setSelectedFileType('binary');
                  setLatex(`% Binary file: ${file.name}\n% Content type: ${file.content_type || fileExtension}\n% Cannot display binary content in the editor.`);
                  return;
                }
                
                toast({
                  title: "File loaded",
                  description: `Loaded ${file.name}`,
                });
              }
            } catch (downloadError) {
              console.error('Error handling binary file:', downloadError);
              toast({
                title: "Error",
                description: `Could not load binary file: ${file.name}`,
                variant: "destructive"
              });
              
              // Show a placeholder message
              setLatex(`% Binary File: ${file.name}\n% Unable to display content in the editor.`);
            }
          } else {
            // Set type to text for non-binary files
            setSelectedFileType('text');
            
            // Load text file content from the database
            console.log('Loading text file from database, id:', file.id);
            const content = await getFileContent(file.id);
            console.log('File content loaded, null?', content === null, 'length:', content?.length);
            
            if (content !== null) {
              console.log('Setting latex content to editor, first 50 chars:', content.substring(0, 50));
              setLatex(content);
            } else {
              // If no content, set default content
              console.log('No content found, setting default content');
              setLatex(`% Content of ${file.name}\n\n% Add your LaTeX content here.`);
            }
          }
        } catch (error) {
          console.error('Error loading file content:', error);
          toast({
            title: "Error",
            description: `Failed to load file content: ${error instanceof Error ? error.message : 'Unknown error'}`,
            variant: "destructive"
          });
        }
      }
    }
  }, []);

  // Handle navigation to specific line in editor from outline
  const handleOutlineItemClick = useCallback((line: number) => {
    // In a real application, we would scroll the editor to that line
    toast({
      title: 'Navigate to line',
      description: `Navigating to line ${line}`
    });
  }, []);

  // Handle file creation
  const handleCreateFile = useCallback(async (fileName?: string, fileType?: string) => {
    if (!documentId) return;
    
    try {
      // If fileName and fileType are provided, use those
      // Otherwise, prompt the user for a file name
      if (!fileName) {
        const promptResult = prompt('Enter file name:');
        if (!promptResult) return; // User canceled the prompt
        fileName = promptResult;
        
        fileType = fileName.includes('.') ? fileName.split('.').pop() : 'tex';
        fileName = fileName.includes('.') ? fileName.split('.')[0] : fileName;
      }
      
      // Create the file in the database
      const fullFileName = `${fileName}.${fileType || 'tex'}`;
      const extension = fileType || 'tex';
      
      const defaultContent = extension === 'tex' ?
        `% ${fullFileName}\n\n\\section{${fileName}}\n\nYour content here.` :
        '';
      
      const newFile = await createFile(
        documentId,
        fullFileName,
        'file',
        null, // parent_id - null for root level
        defaultContent,
        extension
      );
      
      if (newFile) {
        // Refresh the file list
        const updatedFiles = await getDocumentFiles(documentId);
        setFiles(updatedFiles);
        
        // Select the new file
        setSelectedFileId(newFile.id);
        setLatex(defaultContent);
        
        // Show success toast
        toast({
          title: "File created",
          description: `Created ${fullFileName}`,
        });
      }
    } catch (error) {
      console.error('Error creating file:', error);
      toast({
        title: "Error",
        description: "Could not create file",
        variant: "destructive"
      });
    }
  }, [documentId]);

  // Handle file upload
  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!documentId || !files.length) return;
    
    try {
      const fileNames = Array.from(files).map(file => file.name).join(', ');
      console.log(`Uploading ${files.length} files:`, fileNames);
      
      // Upload each file to the database
      const uploadPromises = Array.from(files).map(async (file) => {
        const extension = file.name.split('.').pop() || '';
        
        // Determine if this is a binary file or text file
        const isText = file.type.startsWith('text/') || file.name.endsWith('.tex') || file.name.endsWith('.bib');
        console.log(`Processing ${file.name}, type: ${file.type}, isText: ${isText}`);
        
        if (isText) {
          // Handle text files - read as text
          try {
            const content = await file.text();
            console.log(`Text file ${file.name} read successfully, length: ${content.length}`);
            
            // Create file in database
            return createFile(
              documentId,
              file.name,
              'file',
              null, // parent_id
              content,
              extension
            );
          } catch (err) {
            console.error(`Error reading text file ${file.name}:`, err);
            throw err;
          }
        } else {
          // Handle binary files - pass as binary blob
          console.log(`Processing binary file: ${file.name}`);
          
          // Create file with binary content
          return createFile(
            documentId,
            file.name,
            'file',
            null, // parent_id
            null, // No text content for binary files
            extension,
            file, // Pass the file blob directly
            file.type // Content type
          );
        }
      });
      
      const results = await Promise.all(uploadPromises);
      console.log('Upload results:', results);
      
      // Refresh the file list
      const updatedFiles = await getDocumentFiles(documentId);
      setFiles(updatedFiles);
      
      toast({
        title: "Files uploaded",
        description: `Uploaded: ${fileNames}`,
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Error",
        description: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  }, [documentId, toast]);
  
  // Function to refresh files - can be called from child components
  const refreshFiles = useCallback(async () => {
    if (documentId) {
      console.log('Refreshing file list...');
      const updatedFiles = await getDocumentFiles(documentId);
      setFiles(updatedFiles);
    }
  }, [documentId]);
  
  // This duplicate function has been merged with the handleCreateFile above

  const handleCompile = useCallback(async () => {
    setIsCompiling(true);
    setCompileError(null);
    
    try {
      // Save the current file content before compiling
      if (selectedFileId) {
        await updateFile(selectedFileId, { content: latex });
      }
      
      const result = await compileLatex(latex);
      
      if (result.success && result.pdf) {
        setPdfData(result.pdf);
        toast({
          title: "Compilation successful",
          description: "Your LaTeX document has been compiled.",
        });
      } else {
        setCompileError(result.error || 'Compilation failed');
        toast({
          title: "Compilation failed",
          description: result.error || "Unable to compile your LaTeX document.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error compiling LaTeX:', error);
      setCompileError(error instanceof Error ? error.message : 'Unknown error occurred');
      toast({
        title: "Compilation failed",
        description: "Unable to compile your LaTeX document.",
        variant: "destructive",
      });
    } finally {
      setIsCompiling(false);
    }
  }, [latex, selectedFileId, toast]);

  const handleShare = useCallback(() => {
    setIsShareModalOpen(true);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-lg font-light">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      <header className="flex items-center justify-between bg-background px-6 py-3 border-b">
        <div className="flex items-center gap-2">
          {/* Left sidebar toggle button */}
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
          >
            {leftSidebarCollapsed ? (
              <Menu className="h-5 w-5" />
            ) : (
              <MenuSquare className="h-5 w-5" />
            )}
          </Button>
          
          <h1 className="text-lg font-medium">Kepler</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Right sidebar toggle button */}
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1"
            onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
          >
            <History className="h-4 w-4" />
            <span>History</span>
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            <Expand className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsShareModalOpen(true)}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 w-full overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full border-0 divide-x divide-gray-200 overflow-hidden">
          {/* Left Sidebar */}
          {!leftSidebarCollapsed && (
            <>
              <ResizablePanel defaultSize={15} minSize={10} maxSize={25} className="bg-background border-r border-r-gray-300 overflow-hidden relative">
                <LeftSidebar
                  documentId={documentId}
                  files={files}
                  documentContent={latex}
                  onFileSelect={handleFileSelect}
                  onOutlineItemClick={handleOutlineItemClick}
                  onUploadFiles={handleFileUpload}
                  onCreateFile={handleCreateFile}
                  selectedFileId={selectedFileId}
                  collapsed={leftSidebarCollapsed}
                  onToggleCollapse={setLeftSidebarCollapsed}
                  refreshFiles={refreshFiles}
                />
              </ResizablePanel>
              <ResizableHandle className="bg-muted hover:bg-muted-foreground/50 transition-colors" />
            </>
          )}
          
          {/* Main Editor/Preview Panel */}
          <ResizablePanel defaultSize={35} className="overflow-hidden">
            <Card className="h-full rounded-none border-0 shadow-none bg-background p-0 relative overflow-hidden">
              <div className="h-full relative">
                {selectedFileType === 'text' ? (
                  /* LaTeX Editor for text files */
                  <LatexEditor 
                    initialValue={latex}
                    onChange={async (value) => {
                      const newContent = value || '';
                      setLatex(newContent);
                      
                      // Auto-save content to the current file
                      if (selectedFileId) {
                        try {
                          await updateFile(selectedFileId, { content: newContent });
                        } catch (error) {
                          console.error('Error auto-saving file:', error);
                        }
                      }
                    }}
                    documentId={documentId}
                    onError={(error) => {
                      setCompileError(error);
                      setShowErrorDetails(true);
                    }}
                    onCompileSuccess={(data) => {
                      setPdfData(data);
                      setCompileError(null);
                    }}
                  />
                ) : (
                  /* Binary Preview for PDFs and images */
                  <div className="absolute inset-0 overflow-auto">
                    <BinaryPreview 
                      fileType={selectedFileType}
                      fileName={selectedFileName}
                      data={selectedFileType === 'pdf' ? selectedPdfData : imageUrl}
                    />
                  </div>
                )}
              </div>
            </Card>
          </ResizablePanel>
          
          <ResizableHandle className="bg-muted hover:bg-muted-foreground/50 transition-colors" />
          
          {/* PDF Preview */}
          <ResizablePanel defaultSize={35}>
            <Card className="h-full rounded-none border-0 shadow-none bg-background p-0 overflow-hidden">
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-none flex items-center justify-between border-b px-2 py-2">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleCompile}
                      disabled={isCompiling}
                      className="min-w-[120px]"
                      size="sm"
                    >
                      {isCompiling ? 'Compiling...' : 'Compile LaTeX'}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className={compileError ? 'text-destructive border-destructive hover:bg-destructive/10' : ''}
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                    >
                      <AlertCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {pdfData && (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-slate-100"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-slate-600 font-medium min-w-[80px] text-center">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-slate-100"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage >= totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <div className="border-l mx-2 h-6" />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-slate-100"
                        onClick={() => setScale(Math.min(2, scale + 0.25))}
                        disabled={scale >= 2}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-slate-100"
                        onClick={() => setScale(Math.max(0.5, scale - 0.25))}
                        disabled={scale <= 0.5}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-slate-100"
                        onClick={() => {
                          // TODO: Implement PDF search functionality
                          toast({
                            title: "Search",
                            description: "PDF search functionality coming soon!",
                          });
                        }}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  {showErrorDetails ? (
                    <div className="p-4 bg-muted/20">
                      <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                        <AlertCircle className={`h-4 w-4 ${compileError ? 'text-destructive' : 'text-muted-foreground'}`} />
                        {compileError ? 'Compilation Errors' : 'No Compilation Errors'}
                      </h3>
                      {compileError ? (
                        <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/30 p-4 rounded-md">
                          {compileError}
                        </pre>
                      ) : (
                        <p className="text-sm text-muted-foreground">Your LaTeX document has no compilation errors.</p>
                      )}
                    </div>
                  ) : (
                    <PDFPreview
                      pdfData={pdfData}
                      className="h-full"
                      currentPage={currentPage}
                      scale={scale}
                      onPageChange={setCurrentPage}
                      onTotalPagesChange={setTotalPages}
                    />
                  )}
                </div>
              </div>
            </Card>
          </ResizablePanel>
          
          <ResizableHandle className="bg-muted hover:bg-muted-foreground/50 transition-colors" />
          
          {/* Right Sidebar */}
          {!rightSidebarCollapsed && (
            <>
              <ResizableHandle className="bg-muted hover:bg-muted-foreground/50 transition-colors" />
              <ResizablePanel defaultSize={15} minSize={10} maxSize={25} className="bg-background border-r border-gray-200">
                <RightSidebar
                  documentId={documentId}
                  onVersionRestore={setLatex}
                  className="h-full"
                  collapsed={rightSidebarCollapsed}
                  onToggleCollapse={setRightSidebarCollapsed}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </main>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        documentId={documentId}
        documentTitle={selectedFileId === 'root-1' ? 'Main Document' : undefined}
      />
    </div>
  );
}
