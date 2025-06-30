"use client";

import React, { useState, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronDown, Hash } from 'lucide-react';

interface OutlineItem {
  id: string;
  level: number; // 1 for section, 2 for subsection, etc.
  title: string;
  line: number;
  children?: OutlineItem[];
}

interface FileOutlineProps {
  content: string;
  onItemClick: (line: number) => void;
}

export function FileOutline({ content, onItemClick }: FileOutlineProps) {
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Parse LaTeX content to extract outline items
  useEffect(() => {
    if (!content) {
      setOutline([]);
      return;
    }

    const items: OutlineItem[] = [];
    let id = 1;

    // Split content into lines
    const lines = content.split('\n');
    
    // Regular expressions for various section types
    const sectionRegex = /\\(part|chapter|(?:sub)*section|paragraph)\*?\{([^}]+)\}/;

    // Maps LaTeX section commands to hierarchy levels
    const levelMap: Record<string, number> = {
      'part': 0,
      'chapter': 1,
      'section': 1,
      'subsection': 2,
      'subsubsection': 3,
      'paragraph': 4
    };

    lines.forEach((line, index) => {
      const match = line.match(sectionRegex);
      if (match) {
        const sectionType = match[1];
        const title = match[2];
        const level = levelMap[sectionType] || 1;
        
        items.push({
          id: String(id++),
          level,
          title,
          line: index + 1
        });
      }
    });

    // Organize items into hierarchy
    const organizeHierarchy = (items: OutlineItem[]): OutlineItem[] => {
      const result: OutlineItem[] = [];
      const stack: OutlineItem[] = [];

      for (const item of items) {
        // Pop items from stack until we find a parent or the stack is empty
        while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
          stack.pop();
        }

        if (stack.length === 0) {
          // Top-level item
          result.push(item);
        } else {
          // Add as child to the last item in the stack
          const parent = stack[stack.length - 1];
          parent.children = parent.children || [];
          parent.children.push(item);
        }

        stack.push(item);
      }

      return result;
    };

    setOutline(organizeHierarchy(items));
    
    // Expand all top-level items by default
    const newExpandedItems: Record<string, boolean> = {};
    items.forEach(item => {
      if (item.level <= 1) {
        newExpandedItems[item.id] = true;
      }
    });
    setExpandedItems(newExpandedItems);
  }, [content]);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const renderOutlineItem = (item: OutlineItem, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems[item.id];

    return (
      <div key={item.id}>
        <div 
          className="flex items-center py-1 px-2 hover:bg-accent/20 rounded-md cursor-pointer"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => onItemClick(item.line)}
        >
          {hasChildren ? (
            <span 
              className="mr-1" 
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(item.id);
              }}
            >
              {isExpanded ? 
                <ChevronDown className="h-4 w-4 text-muted-foreground" /> : 
                <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </span>
          ) : (
            <Hash className="h-4 w-4 mr-1 text-muted-foreground" />
          )}
          <span className="text-sm truncate">{item.title}</span>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {item.children!.map(child => renderOutlineItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full border rounded-md">
      <div className="p-2 border-b">
        <h2 className="text-lg font-semibold">Document Outline</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {outline.length > 0 ? (
            outline.map(item => renderOutlineItem(item))
          ) : (
            <div className="text-sm text-muted-foreground p-2">
              No sections found in document.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
