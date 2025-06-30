"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VersionService } from '@/lib/versions';
import { VersionMetadata } from '@/types/version';
import { formatDistanceToNow } from 'date-fns';

interface VersionHistoryProps {
  documentId: string;
  onVersionRestore: (content: string) => void;
}

export function VersionHistory({ documentId, onVersionRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>();

  const loadVersions = async () => {
    try {
      setIsLoading(true);
      const versions = await VersionService.listVersions(documentId);
      setVersions(versions);
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [documentId]);

  const handleCreateSnapshot = async () => {
    try {
      const message = prompt('Enter a message for this version (optional):');
      await VersionService.createSnapshot(documentId, '', message || undefined);
      loadVersions(); // Refresh the version list
    } catch (error) {
      console.error('Error creating snapshot:', error);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    try {
      const version = await VersionService.getVersion(versionId);
      await VersionService.restoreVersion(documentId, versionId);
      onVersionRestore(version.content);
    } catch (error) {
      console.error('Error restoring version:', error);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Version History</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-4">
          <Button onClick={handleCreateSnapshot}>Create Snapshot</Button>
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="text-center py-4">Loading versions...</div>
            ) : versions.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No versions found. Create a snapshot to save your current progress.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {versions.map((version) => (
                  <Card key={version.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                        </div>
                        {version.message && (
                          <div className="text-sm text-gray-500 mt-1">{version.message}</div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleRestoreVersion(version.id)}
                      >
                        Restore
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
