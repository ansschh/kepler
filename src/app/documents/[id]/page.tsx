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
import { FileNode } from "@/components/file-tree";
import { Expand, Share2, X, ChevronRight, ChevronLeft, Menu, MenuSquare, History } from 'lucide-react';
import { RealtimeService } from '@/lib/realtime';
import { Document } from '@/types/document';
import { supabase } from '@/lib/supabase';
import { compileLatex } from '@/lib/latex-compiler';
import { useParams } from 'next/navigation';
import { toast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShareModal } from '@/components/ui/share-modal';
import { AlertCircle } from 'lucide-react';

export default function SharedDocument() {
  const params = useParams();
  const documentId = params.id as string;
  
  const [latex, setLatex] = useState('');
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null); // Changed to null to match PDFPreview props type
  const [isLoading, setIsLoading] = useState(true);
  
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
  
  // Sample project files - in a real app, these would come from an API
  const [files, setFiles] = useState<FileNode[]>([
    {
      id: 'root-1',
      name: 'main.tex',
      type: 'file',
      extension: 'tex'
    },
    {
      id: 'root-2',
      name: 'bibliography.bib',
      type: 'file',
      extension: 'bib'
    },
    {
      id: 'root-3',
      name: 'figures',
      type: 'directory',
      children: [
        {
          id: 'fig-1',
          name: 'diagram.png',
          type: 'file',
          extension: 'png'
        },
        {
          id: 'fig-2',
          name: 'photo.jpg',
          type: 'file',
          extension: 'jpg'
        }
      ]
    },
    {
      id: 'root-4',
      name: 'sections',
      type: 'directory',
      children: [
        {
          id: 'sec-1',
          name: 'introduction.tex',
          type: 'file',
          extension: 'tex'
        },
        {
          id: 'sec-2',
          name: 'methods.tex',
          type: 'file',
          extension: 'tex'
        }
      ]
    }
  ]);
  
  // Currently selected file
  const [selectedFileId, setSelectedFileId] = useState('root-1'); // Default to main.tex

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
      } catch (error) {
        console.error('Error loading document:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [documentId]);

  // Handle file selection from file tree
  const handleFileSelect = useCallback((file: FileNode) => {
    // Set the file as active using its ID
    if (file) {
      setSelectedFileId(file.id);
      
      // If it's a file (not a folder), load its content
      if (file.type === 'file') {
        // Here we would typically load the file content from backend
        // For now, use hardcoded content if it's the main.tex file
        if (file.name === 'main.tex') {
          setLatex(latex);
        } else {
          setLatex(`% Content of ${file.name}\n\n% Add your LaTeX content here.`);
        }
      }
    }
  }, [latex]);

  // Handle navigation to specific line in editor from outline
  const handleOutlineItemClick = useCallback((line: number) => {
    // In a real application, we would scroll the editor to that line
    toast({
      title: 'Navigate to line',
      description: `Navigating to line ${line}`
    });
  }, []);

  // Handle file creation
  const handleCreateFile = useCallback((fileName?: string, fileType?: string) => {
    // If fileName and fileType are provided, use those
    // Otherwise, prompt the user for a file name
    if (!fileName) {
      const promptResult = prompt('Enter file name:');
      if (!promptResult) return; // User canceled the prompt
      fileName = promptResult;
      
      fileType = fileName.includes('.') ? fileName.split('.').pop() : 'tex';
      fileName = fileName.includes('.') ? fileName.split('.')[0] : fileName;
    }
    
    // Create a new file node
    const newFile: FileNode = {
      id: `new-${Date.now()}`,
      name: `${fileName}.${fileType || 'tex'}`,
      type: 'file',
      extension: fileType || 'tex'
    };
    
    // Update file list and select the new file
    setFiles(prev => [...prev, newFile]);
    setSelectedFileId(newFile.id);
    
    // Show success toast
    toast({
      title: "File created",
      description: `Created ${fileName}.${fileType || 'tex'}`,
    });
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback((files: FileList) => {
    // In a real application, we would upload these files to the server
    // For demo purposes, we'll show the file names
    const fileNames = Array.from(files).map(file => file.name).join(', ');
    
    // Create file nodes for each uploaded file
    const newFiles: FileNode[] = Array.from(files).map((file, index) => {
      const extension = file.name.split('.').pop() || '';
      return {
        id: `uploaded-${Date.now()}-${index}`,
        name: file.name,
        type: 'file',
        extension
      };
    });
    
    // Update file list
    setFiles(prev => [...prev, ...newFiles]);
    
    toast({
      title: "Files uploaded",
      description: `Uploaded: ${fileNames}`,
    });
  }, []);
  
  // This duplicate function has been merged with the handleCreateFile above

  const handleCompile = useCallback(async () => {
    setIsCompiling(true);
    setCompileError(null);
    
    try {
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
  }, [latex, toast]);

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

      <main className="flex-1 w-full">
        <ResizablePanelGroup direction="horizontal" className="h-full border-0">
          {/* Left Sidebar */}
          {!leftSidebarCollapsed && (
            <>
              <ResizablePanel defaultSize={15} minSize={10} maxSize={25} className="bg-background">
                <LeftSidebar
                  files={files}
                  documentContent={latex}
                  onFileSelect={handleFileSelect}
                  onOutlineItemClick={handleOutlineItemClick}
                  onUploadFiles={handleFileUpload}
                  onCreateFile={handleCreateFile}
                  selectedFileId={selectedFileId}
                  className="h-full"
                  collapsed={leftSidebarCollapsed}
                  onToggleCollapse={setLeftSidebarCollapsed}
                />
              </ResizablePanel>
              <ResizableHandle className="bg-muted hover:bg-muted-foreground/50 transition-colors" />
            </>
          )}
          
          {/* LaTeX Editor */}
          <ResizablePanel defaultSize={35}>
            <Card className="h-full rounded-none border-0 shadow-none bg-background p-0">
              <div className="h-full">
                <LatexEditor 
                  initialValue={latex}
                  onChange={setLatex}
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
              </div>
            </Card>
          </ResizablePanel>
          
          <ResizableHandle className="bg-muted hover:bg-muted-foreground/50 transition-colors" />
          
          {/* PDF Preview */}
          <ResizablePanel defaultSize={35}>
            <Card className="h-full rounded-none border-0 shadow-none bg-background p-0">
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 border-b px-2 py-2">
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
                    <PDFPreview pdfData={pdfData} />
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
              <ResizablePanel defaultSize={15} minSize={10} maxSize={25} className="bg-background">
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
