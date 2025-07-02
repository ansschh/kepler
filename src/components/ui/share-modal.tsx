"use client";

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { toast } from './use-toast';
import { RealtimeService } from '@/lib/realtime';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { supabase } from '@/lib/supabase';
import { Loader2, Trash2 } from "lucide-react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle?: string;
}

interface PendingInvite {
  email: string;
  permission: 'view' | 'edit';
  created_at: string;
  status: 'pending' | 'accepted';
}

export function ShareModal({ isOpen, onClose, documentId, documentTitle }: ShareModalProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('edit');
  const [resendingTo, setResendingTo] = useState<string>('');
  const [removingEmail, setRemovingEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  // Fetch pending invites function with error handling and retry logic
  const fetchPendingInvites = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('document_collaborators')
        .select('email, permission, created_at, status')
        .eq('document_id', documentId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending invites:', error);
        toast({
          title: "Failed to fetch invites",
          description: "Could not load existing collaborators",
          variant: "destructive",
        });
        return;
      }

      setPendingInvites(data || []);
    } catch (error) {
      console.error('Error fetching pending invites:', error);
      toast({
        title: "Failed to fetch invites",
        description: error instanceof Error ? error.message : "Failed to fetch pending invites",
        variant: "destructive",
      });
    }
  }, [documentId, toast]);

  // Set up real-time updates for collaborators
  useEffect(() => {
    if (!isOpen || !documentId) return;

    // Initial fetch
    fetchPendingInvites();

    // Set up real-time service
    const realtimeService = new RealtimeService(
      () => {}, // No document updates needed
      (error) => {
        console.error('Real-time error:', error);
        toast({
          title: 'Error',
          description: 'Failed to receive real-time updates. Please refresh.',
          variant: 'destructive'
        });
      },
      // Callback for collaborator updates
      (collaborators) => {
        setPendingInvites(collaborators.map(collab => ({
          email: collab.email,
          permission: collab.permission,
          status: collab.status,
          created_at: new Date().toISOString() // Use current time as we don't get this from realtime
        })));
      }
    );

    // Join document channel
    realtimeService.joinDocument(documentId).catch(error => {
      console.error('Failed to join document channel:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to establish real-time connection. Updates may be delayed.',
        variant: 'destructive'
      });
    });

    return () => {
      realtimeService.leaveDocument().catch(console.error);
    };
  }, [documentId, isOpen, fetchPendingInvites, toast]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await RealtimeService.shareDocument(documentId, email, permission);
      toast({
        title: "Invitation sent",
        description: `An invitation has been sent to ${email}`,
      });
      setEmail('');
      // No need to manually refresh - real-time will handle it
    } catch (error) {
      toast({
        title: "Failed to share",
        description: error instanceof Error ? error.message : "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveCollaborator = async (inviteEmail: string) => {
    try {
      setRemovingEmail(inviteEmail);
      await RealtimeService.removeCollaborator(documentId, inviteEmail);
      toast({
        title: "Collaborator removed",
        description: `${inviteEmail} has been removed from the document`,
      });
      // No need to manually refresh - real-time will handle it
    } catch (error) {
      toast({
        title: "Failed to remove collaborator",
        description: error instanceof Error ? error.message : "Failed to remove collaborator",
        variant: "destructive",
      });
    } finally {
      setRemovingEmail('');
    }
  };

  const handleResendInvite = async (inviteEmail: string) => {
    try {
      setResendingTo(inviteEmail);
      await RealtimeService.shareDocument(documentId, inviteEmail, 'edit', true); // Pass resend=true
      toast({
        title: "Invitation resent",
        description: `A new invitation has been sent to ${inviteEmail}`,
      });
    } catch (error) {
      toast({
        title: "Failed to resend",
        description: error instanceof Error ? error.message : "Failed to resend invitation",
        variant: "destructive",
      });
    } finally {
      setResendingTo('');
    }
  };

  const handleUpdatePermission = async (inviteEmail: string, newPermission: 'edit' | 'review' | 'view') => {
    try {
      const { error } = await supabase
        .from('document_collaborators')
        .update({ permission: newPermission })
        .eq('document_id', documentId)
        .eq('email', inviteEmail);

      if (error) throw error;

      toast({
        title: "Permission updated",
        description: `Updated permission for ${inviteEmail}`,
      });

      // Refresh pending invites
      const { data } = await supabase
        .from('document_collaborators')
        .select('email, permission, created_at, status')
        .eq('document_id', documentId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPendingInvites(data || []);
    } catch (error) {
      toast({
        title: "Failed to update permission",
        description: error instanceof Error ? error.message : "Failed to update permission",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>
            {documentTitle ? `Share "${documentTitle}" with others` : 'Share this document with others'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleShare} className="grid gap-4 py-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-[2fr,1fr] gap-2">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter recipient's email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="permission">Permission</Label>
                <Select value={permission} onValueChange={(value: any) => setPermission(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select permission" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="edit">Editor</SelectItem>
                    <SelectItem value="view">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </div>

          {pendingInvites.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Pending Invitations</h3>
              <div className="border rounded-md divide-y">
                {pendingInvites.map((invite) => (
                  <div key={invite.email} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{invite.email}</p>
                      <p className="text-xs text-gray-500">
                        Invited {new Date(invite.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={invite.permission}
                        onValueChange={(value: any) => handleUpdatePermission(invite.email, value)}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="edit">Editor</SelectItem>
                          <SelectItem value="view">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendInvite(invite.email)}
                          disabled={resendingTo === invite.email || removingEmail === invite.email}
                        >
                          {resendingTo === invite.email ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Resending...
                            </>
                          ) : (
                            <>Resend</>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 transition-colors hover:bg-destructive/10 focus-visible:ring-destructive group"
                          onClick={() => handleRemoveCollaborator(invite.email)}
                          disabled={resendingTo === invite.email || removingEmail === invite.email}
                        >
                          {removingEmail === invite.email ? (
                            <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive/60 group-hover:text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
