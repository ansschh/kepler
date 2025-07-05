"use client";

import * as React from 'react';
import { useEffect, useRef, useCallback, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Text, ChangeSpec, Extension } from '@codemirror/state';
import { ViewUpdate } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { RealtimeService } from '@/lib/realtime';
import { DocumentUpdate } from '@/types/document';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { EditorToolbar } from '@/components/editor-toolbar';
import { ThemeToggle } from '@/components/theme-toggle';
import { FormattingMenu } from '@/components/formatting-menu';

interface LatexEditorProps {
  initialValue: string;
  onChange?: (value: string) => void;
  documentId?: string;
  onCompileSuccess?: (pdfData: Uint8Array) => void;
  onError?: (error: string) => void;
}

const getDefaultExtensions = (onChange?: (value: string) => void, realtimeRef?: React.MutableRefObject<RealtimeService | null>, isRemoteUpdateRef?: React.MutableRefObject<boolean>): Extension[] => [
  basicSetup,
  javascript({ typescript: true }),
  oneDark,
  EditorView.updateListener.of((update: ViewUpdate) => {
    if (update.docChanged && isRemoteUpdateRef && !isRemoteUpdateRef.current) {
      const changes = update.changes;
      changes.iterChanges((fromA: number, toA: number, fromB: number, toB: number, inserted: Text) => {
        const updatePayload: DocumentUpdate = {
          type: toA === fromA ? 'insert' : toA > fromA ? 'replace' : 'delete',
          from: fromA,
          to: toA,
          text: inserted.toString(),
        };

        realtimeRef?.current?.sendUpdate(updatePayload);
      });

      if (onChange) {
        onChange(update.state.doc.toString());
      }
    }
  })
];

export function LatexEditor({ initialValue, onChange, documentId, onCompileSuccess, onError }: LatexEditorProps): React.ReactElement {
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const realtimeRef = useRef<RealtimeService | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const isRemoteUpdateRef = useRef<boolean>(false);
  const compileButtonRef = useRef<HTMLButtonElement>(null);
  const [editorSelection, setEditorSelection] = useState<{from: number, to: number} | null>(null);
  
  // This handles text insertion from the toolbar
  const handleInsertText = useCallback((text: string) => {
    const view = viewRef.current;
    if (!view) return;
    
    const selection = view.state.selection.main;
    const selectedText = view.state.sliceDoc(selection.from, selection.to);
    
    // Replace $SELECTION$ placeholder with the actual selected text
    const insertText = text.replace('$SELECTION$', selectedText);
    
    // Calculate final cursor position
    const cursorPos = selectedText ? 
      selection.from + insertText.length : 
      selection.from + insertText.length;
    
    // Create the change transaction
    view.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: insertText
      },
      selection: { anchor: cursorPos }
    });
    
    // Update remote collaborators
    if (realtimeRef.current) {
      const updatePayload: DocumentUpdate = {
        type: selection.from === selection.to ? 'insert' : 'replace',
        from: selection.from,
        to: selection.to,
        text: insertText,
      };
      realtimeRef.current.sendUpdate(updatePayload);
    }
    
    // Focus back on editor
    view.focus();
    
    // Trigger onChange callback
    if (onChange) {
      onChange(view.state.doc.toString());
    }
  }, [onChange]);

  const handleRemoteUpdate = useCallback((update: DocumentUpdate) => {
    const view = viewRef.current;
    if (!view) return;

    const change: ChangeSpec = {
      from: update.from,
      to: update.to,
      insert: update.text || '',
    };

    isRemoteUpdateRef.current = true;
    view.dispatch({ changes: change });
    isRemoteUpdateRef.current = false;
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('Realtime error:', error);
  }, []);

  // Create the editor instance only once
  useEffect(() => {
    if (!editorRef.current) return;

    const realtime = documentId ? new RealtimeService(handleRemoteUpdate, handleError) : null;
    realtimeRef.current = realtime;

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        ...getDefaultExtensions(onChange, realtimeRef, isRemoteUpdateRef),
        EditorView.theme({
          '&': {
            height: '100%'
          },
          '.cm-scroller': {
            overflow: 'auto !important',
            fontFamily: 'monospace'
          },
          '.cm-content': {
            minHeight: '100%'
          },
          '.cm-line': {
            padding: '0 4px'
          }
        })
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });
    
    // Ensure the editor container allows scrolling
    if (editorRef.current) {
      editorRef.current.style.overflow = 'auto';
      editorRef.current.style.height = '100%';
    }

    viewRef.current = view;

    if (documentId && realtime) {
      realtime.joinDocument(documentId);
    }

    return () => {
      if (realtime) {
        realtime.leaveDocument();
      }
      view.destroy();
    };
  }, [onChange, documentId, handleRemoteUpdate, handleError]); // Removed initialValue to prevent recreation
  
  // Update editor content when initialValue changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    
    console.log('LatexEditor - initialValue changed, updating content');
    
    // Only update if content actually changed
    const currentContent = view.state.doc.toString();
    if (currentContent !== initialValue) {
      console.log('LatexEditor - content differs, setting new content');
      console.log('Current length:', currentContent.length, 'New length:', initialValue.length);
      
      // Set flag to prevent triggering remote updates
      isRemoteUpdateRef.current = true;
      
      // Replace entire document content
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: initialValue },
        scrollIntoView: true
      });
      
      // Reset flag
      isRemoteUpdateRef.current = false;
    }
  }, [initialValue]);

  const handleCompile = async () => {
    if (!viewRef.current) return;

    setIsCompiling(true);
    setCompileError(null);

    try {
      // Get content and ensure proper LaTeX formatting
      const content = viewRef.current.state.doc.toString();
      
      // Fix common LaTeX command issues
      let formattedContent = content
        .replace(/([^\\])documentclass/g, '$1\\documentclass')
        .replace(/([^\\])begin\{/g, '$1\\begin{')
        .replace(/([^\\])end\{/g, '$1\\end{')
        .trim();
      
      // Ensure proper LaTeX document structure
      if (!formattedContent.includes('\\documentclass')) {
        formattedContent = '\\documentclass{article}\n' + formattedContent;
      }
      if (!formattedContent.includes('\\begin{document}')) {
        formattedContent = formattedContent + '\n\\begin{document}\n';
      }
      if (!formattedContent.includes('\\end{document}')) {
        formattedContent = formattedContent + '\n\\end{document}';
      }

      console.log('Formatted LaTeX content:', formattedContent);

      const formData = new FormData();
      formData.append('tex_content', formattedContent);

      console.log('Sending request to:', process.env.NEXT_PUBLIC_LATEX_COMPILER_URL + '/compile');
      // Request PDF as binary data
      const response = await fetch(process.env.NEXT_PUBLIC_LATEX_COMPILER_URL + '/compile', {
        method: 'POST',
        headers: {
          'Accept': 'application/pdf, application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        console.error('HTTP error:', response.status, await response.text());
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Check content type to determine how to handle the response
      const contentType = response.headers.get('content-type');
      console.log('Response content type:', contentType);

      if (contentType?.includes('application/pdf')) {
        // Direct PDF response
        try {
          const pdfBlob = await response.blob();
          const pdfArrayBuffer = await pdfBlob.arrayBuffer();
          const pdfData = new Uint8Array(pdfArrayBuffer);
          
          console.log('Received PDF binary data, length:', pdfData.length);
          
          // Verify PDF header
          const pdfHeader = new TextDecoder().decode(pdfData.slice(0, 8));
          console.log('PDF header:', pdfHeader);
          
          if (!pdfHeader.startsWith('%PDF-')) {
            throw new Error('Invalid PDF format');
          }
          
          onCompileSuccess?.(pdfData);
          toast({
            title: "Compilation Successful",
            description: "Your LaTeX document has been compiled successfully.",
          });
          return;
        } catch (e) {
          console.error('Failed to process PDF data:', e);
          throw new Error('Failed to process PDF data');
        }
      }

      // If not PDF, expect JSON response
      const result = await response.json();
      console.log('Compiler response:', result);
      
      if (result.success && result.pdf) {
        console.error('Unexpected response format - got JSON with PDF data instead of direct PDF');
        throw new Error('Unexpected response format');
      }
      
      const errorMsg = result.error || result.log || "Unknown error occurred";
      setCompileError(errorMsg);
      onError?.(errorMsg);
      toast({
        variant: "destructive",
        title: "Compilation Failed",
        description: "Failed to compile LaTeX document. Check the error log for details.",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setCompileError(errorMessage);
      onError?.(errorMessage);
      toast({
        variant: "destructive",
        title: "Compilation Error",
        description: errorMessage,
      });
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar onInsert={handleInsertText} />
      <div className="flex-1 relative">
        <div
          ref={editorRef}
          className="absolute inset-0 overflow-auto"
          style={{
            fontFamily: 'monospace',
          }}
        />
      </div>
    </div>
  );
}
