"use client";

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { toast } from './use-toast';
import { RealtimeService, Collaborator } from '@/lib/realtime';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { supabase } from '@/lib/supabase';
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

// Component for the confirmation dialog rendered completely separately
function RemoveCollaboratorDialog({ 
  email, 
  isOpen, 
  onClose, 
  onConfirm 
}: { 
  email: string | null, 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: (email: string) => void 
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Collaborator</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {email} from this document?
            This will revoke their access immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90 !ring-offset-background !focus:ring-2 !focus:ring-destructive !focus:ring-offset-2"
            onClick={() => email && onConfirm(email)}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ShareModal({ isOpen, onClose, documentId, documentTitle }: ShareModalProps) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('edit');
  const [resendingTo, setResendingTo] = useState<string>('');
  const [removingEmail, setRemovingEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [confirmRemoveEmail, setConfirmRemoveEmail] = useState<string | null>(null);

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
      
      // Manually add the new invite to the list immediately while waiting for real-time
      const newInvite: PendingInvite = {
        email: email,
        permission: permission,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      setPendingInvites(prev => [newInvite, ...prev]);
      setEmail('');
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
      
      // Manually update the UI immediately while waiting for real-time
      setPendingInvites(prev => prev.filter(invite => invite.email !== inviteEmail));
    } catch (error) {
      toast({
        title: "Failed to remove collaborator",
        description: error instanceof Error ? error.message : "Failed to remove collaborator",
        variant: "destructive",
      });
    } finally {
      setRemovingEmail('');
      setConfirmRemoveEmail(null);
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

  // Create a separate form ref to handle validation manually
  const formRef = React.useRef<HTMLFormElement>(null);
  
  // Function to validate the form manually
  const validateForm = () => {
    if (!email.trim()) {
      return false;
    }
    return true;
  };

  // Modified handleShare to use manual validation
  const handleShareWithValidation = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only proceed if validation passes
    if (validateForm()) {
      handleShare(e);
    } else {
      // Show custom validation message
      toast({
        title: "Email Required",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
    }
  };
  
  // State to control the remove dialog separately from the main form
  const [removeDialogOpen, setRemoveDialogOpen] = React.useState(false);

  // Handle remove button click without triggering form validation
  const handleRemoveClick = (email: string) => {
    // Set the email to remove and open the dialog
    setConfirmRemoveEmail(email);
    setRemoveDialogOpen(true);
  };

  // Handle confirmation of removal
  const handleConfirmRemove = (email: string) => {
    handleRemoveCollaborator(email);
    setRemoveDialogOpen(false);
  };

  return (
    <>
      {/* Completely separate remove dialog component */}
      <RemoveCollaboratorDialog
        email={confirmRemoveEmail}
        isOpen={removeDialogOpen}
        onClose={() => {
          setRemoveDialogOpen(false);
          setConfirmRemoveEmail(null);
        }}
        onConfirm={handleConfirmRemove}
      />
      
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Share Document</DialogTitle>
            <DialogDescription>
              {documentTitle ? `Share "${documentTitle}" with others` : 'Share this document with others'}
            </DialogDescription>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleShareWithValidation} className="grid gap-4 py-4" noValidate>
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
                    // Remove HTML5 validation to use our custom validation
                    required={false}
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
                          onClick={() => handleRemoveClick(invite.email)}
                          disabled={resendingTo === invite.email || removingEmail === invite.email}
                          type="button" // Explicitly set type to button to prevent form submission
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

      {/* Removed the portal-based dialog as we now use a completely separate component */}
    </>
  );
}
