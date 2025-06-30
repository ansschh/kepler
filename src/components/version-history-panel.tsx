"use client";

import { useState, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RealtimeService } from '@/lib/realtime';
import { DocumentVersion } from '@/types/document';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/components/ui/use-toast';

interface VersionHistoryPanelProps {
  documentId: string;
  onVersionRestore: (content: string) => void;
}

export function VersionHistoryPanel({ documentId, onVersionRestore }: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  
  useEffect(() => {
    const loadVersions = async () => {
      try {
        setIsLoading(true);
        const versionHistory = await RealtimeService.getVersionHistory(documentId);
        setVersions(versionHistory);
      } catch (error) {
        console.error('Error loading versions:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load document version history."
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadVersions();
  }, [documentId]);

  const handleRestore = async (versionId: string) => {
    try {
      const versionContent = await RealtimeService.getVersionContent(documentId, versionId);
      onVersionRestore(versionContent);
      toast({
        title: "Version Restored",
        description: "Document has been restored to the selected version."
      });
    } catch (error) {
      console.error('Error restoring version:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to restore document version."
      });
    }
  };

  const toggleVersionExpand = (versionId: string) => {
    setExpandedVersionId(expandedVersionId === versionId ? null : versionId);
  };
  
  // Function to calculate color based on version change size
  const getChangeColor = (version: DocumentVersion) => {
    const changeSize = version.changeSize || 0;
    if (changeSize > 100) return 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700';
    if (changeSize < -100) return 'bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700';
    return 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700';
  };

  return (
    <div className="h-full flex flex-col p-4">
      <h3 className="font-medium mb-4">Version History</h3>
      
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : versions.length > 0 ? (
        <ScrollArea className="flex-1">
          <div className="space-y-3">
            {versions.map((version) => (
              <div 
                key={version.id} 
                className={`border rounded-md overflow-hidden ${getChangeColor(version)}`}
              >
                <div 
                  className="p-3 cursor-pointer flex justify-between items-start"
                  onClick={() => toggleVersionExpand(version.id)}
                >
                  <div>
                    <div className="font-medium">
                      {version.author?.name || 'Unknown user'}
                    </div>
                    <div className="text-sm opacity-70">
                      {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="text-sm">
                    {version.changeSize > 0 ? `+${version.changeSize}` : version.changeSize} chars
                  </div>
                </div>
                
                {expandedVersionId === version.id && (
                  <div className="border-t p-3 bg-background/80">
                    <div className="mb-3 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs">
                      {version.diffPreview || 'No preview available'}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleRestore(version.id)}
                    >
                      Restore this version
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center p-4">
          <div>
            <p className="text-muted-foreground">No version history available</p>
            <p className="text-xs text-muted-foreground mt-1">Changes will be saved automatically as you type</p>
          </div>
        </div>
      )}
    </div>
  );
}
