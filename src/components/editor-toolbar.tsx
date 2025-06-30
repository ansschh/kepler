"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Image, Table, Square, Link, Code, FileSymlink,
  Type, MessageSquare, FlipHorizontal2, Brackets, Sigma
} from 'lucide-react';

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function ToolbarButton({ icon, label, onClick }: ToolbarButtonProps) {
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-7 w-7" 
      onClick={onClick}
      title={label}
    >
      {icon}
    </Button>
  );
}

interface EditorToolbarProps {
  onInsert: (text: string) => void;
}

export function EditorToolbar({ onInsert }: EditorToolbarProps) {
  // Helper to insert text into editor
  const insert = (before: string, after: string = '') => {
    onInsert(`${before}${after}`);
  };

  const insertWithSelection = (before: string, after: string = '') => {
    onInsert(`${before}$SELECTION$${after}`);
  };

  // LaTeX-specific toolbar actions
  const actions = [
    // Formatting section
    { 
      icon: <Bold size={16} />, 
      label: "Bold", 
      onClick: () => insertWithSelection('\\textbf{', '}') 
    },
    { 
      icon: <Italic size={16} />, 
      label: "Italic", 
      onClick: () => insertWithSelection('\\textit{', '}') 
    },
    { 
      icon: <Underline size={16} />, 
      label: "Underline", 
      onClick: () => insertWithSelection('\\underline{', '}') 
    },
    { 
      icon: <Type size={16} />, 
      label: "Font Size", 
      onClick: () => insertWithSelection('\\large{', '}') 
    },
    
    // Structure section
    { 
      icon: <AlignLeft size={16} />, 
      label: "Section", 
      onClick: () => insertWithSelection('\\section{', '}') 
    },
    { 
      icon: <AlignCenter size={16} />, 
      label: "Subsection", 
      onClick: () => insertWithSelection('\\subsection{', '}') 
    },
    { 
      icon: <AlignRight size={16} />, 
      label: "Subsubsection", 
      onClick: () => insertWithSelection('\\subsubsection{', '}') 
    },
    
    // Lists section
    { 
      icon: <List size={16} />, 
      label: "Itemize", 
      onClick: () => insert('\\begin{itemize}\n\\item $SELECTION$\n\\end{itemize}') 
    },
    { 
      icon: <ListOrdered size={16} />, 
      label: "Enumerate", 
      onClick: () => insert('\\begin{enumerate}\n\\item $SELECTION$\n\\end{enumerate}') 
    },
    
    // Media section
    { 
      icon: <Image size={16} />, 
      label: "Figure", 
      onClick: () => insert('\\begin{figure}[h!]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{filename.png}\n\\caption{$SELECTION$}\n\\label{fig:my-figure}\n\\end{figure}') 
    },
    { 
      icon: <Table size={16} />, 
      label: "Table", 
      onClick: () => insert('\\begin{table}[h!]\n\\centering\n\\begin{tabular}{|c|c|c|}\n\\hline\nCell 1 & Cell 2 & Cell 3 \\\\\n\\hline\n\\end{tabular}\n\\caption{$SELECTION$}\n\\label{tab:my-table}\n\\end{table}') 
    },
    
    // Math section
    { 
      icon: <Square size={16} />, 
      label: "Math Block", 
      onClick: () => insertWithSelection('\\[', '\\]') 
    },
    { 
      icon: <Brackets size={16} />, 
      label: "Inline Math", 
      onClick: () => insertWithSelection('$', '$') 
    },
    { 
      icon: <Sigma size={16} />, 
      label: "Equation", 
      onClick: () => insert('\\begin{equation}\n$SELECTION$\n\\end{equation}') 
    },
    
    // References section
    { 
      icon: <Link size={16} />, 
      label: "Citation", 
      onClick: () => insert('\\cite{$SELECTION$}') 
    },
    { 
      icon: <Code size={16} />, 
      label: "Code Block", 
      onClick: () => insert('\\begin{verbatim}\n$SELECTION$\n\\end{verbatim}') 
    },
    { 
      icon: <FileSymlink size={16} />, 
      label: "Reference", 
      onClick: () => insert('\\ref{$SELECTION$}') 
    },
    { 
      icon: <FlipHorizontal2 size={16} />, 
      label: "Page Reference", 
      onClick: () => insert('\\pageref{$SELECTION$}') 
    },
    { 
      icon: <MessageSquare size={16} />, 
      label: "Comment", 
      onClick: () => insertWithSelection('% ', '') 
    },
  ];

  return (
    <div className="flex flex-wrap bg-muted/10 px-2 py-3 border-b">
      {actions.map((action, index) => (
        <React.Fragment key={action.label}>
          <ToolbarButton 
            icon={action.icon} 
            label={action.label} 
            onClick={action.onClick} 
          />
          {/* Add separator after format, structure, lists, media, math sections */}
          {(index === 3 || index === 6 || index === 8 || index === 10 || index === 13) && (
            <div className="h-6 w-px bg-border mx-0.5 my-0.5"></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
