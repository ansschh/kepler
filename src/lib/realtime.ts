import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Document, DocumentUpdate, DocumentVersion } from '@/types/document';

export interface Collaborator {
  id: string;
  email: string;
  permission: 'view' | 'edit';
  status: 'pending' | 'accepted';
  userId?: string;
}

export class RealtimeService {
  private channel: RealtimeChannel | null = null;
  private documentId: string | null = null;

  constructor(
    private onUpdate: (update: DocumentUpdate) => void,
    private onError: (error: Error) => void,
    private onCollaboratorUpdate?: (collaborators: Collaborator[]) => void
  ) {}

  async joinDocument(documentId: string) {
    if (this.channel) {
      await this.leaveDocument();
    }

    this.documentId = documentId;
    this.channel = supabase.channel(`document:${documentId}`);

    this.channel
      .on('broadcast', { event: 'document_update' }, ({ payload }) => {
        try {
          const update = payload as DocumentUpdate;
          this.onUpdate(update);
        } catch (error) {
          this.onError(error instanceof Error ? error : new Error('Unknown error'));
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_collaborators',
          filter: `document_id=eq.${documentId}`
        },
        async () => {
          if (this.onCollaboratorUpdate) {
            try {
              const collaborators = await RealtimeService.getCollaborators(documentId);
              this.onCollaboratorUpdate(collaborators);
            } catch (error) {
              this.onError(error instanceof Error ? error : new Error('Failed to fetch updated collaborators'));
            }
          }
        }
      )
      .subscribe();
  }

  async sendUpdate(update: DocumentUpdate) {
    if (!this.channel || !this.documentId) {
      throw new Error('Not connected to a document');
    }

    try {
      await this.channel.send({
        type: 'broadcast',
        event: 'document_update',
        payload: update,
      });
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error('Failed to send update'));
    }
  }

  async leaveDocument() {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
      this.documentId = null;
    }
  }

  // Helper method to create a new document
  static async createDocument(title: string, content: string): Promise<Document> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    // First, insert the document without selecting
    const { error: insertError } = await supabase
      .from('documents')
      .insert([
        {
          title,
          content,
          owner_id: user.id,
        },
      ]);

    if (insertError) throw insertError;

    // Then, fetch the most recently created document by this user
    const { data, error: selectError } = await supabase
      .from('documents')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (selectError) throw selectError;
    if (!data) throw new Error('Failed to create document');

    return data as Document;
  }

  // Helper method to get a document
  static async getDocument(id: string): Promise<Document> {
    // First check if user has access to this document
    const { data: collaborators } = await supabase
      .from('document_collaborators')
      .select('permission')
      .eq('document_id', id)
      .eq('email', (await supabase.auth.getUser()).data.user?.email)
      .maybeSingle();

    // Then fetch the document with specific columns
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, content, owner_id, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      throw new Error('Document not found or you do not have permission to access it');
    }

    return data;
  }
  
  // Helper method to get version history
  static async getVersionHistory(documentId: string): Promise<DocumentVersion[]> {
    // In a real implementation, fetch from the database
    // For now, return mock data
    return [
      {
        id: 'version-1',
        documentId,
        content: '\\documentclass{article}\n\\begin{document}\nInitial version\n\\end{document}',
        changeSize: 45,
        diffPreview: '+ Initial version',
        author: {
          id: 'user_1',
          name: 'John Doe',
        },
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      },
      {
        id: 'version-2',
        documentId,
        content: '\\documentclass{article}\n\\begin{document}\nInitial version with some additions\n\\end{document}',
        changeSize: 18,
        diffPreview: '+ with some additions',
        author: {
          id: 'user_1',
          name: 'John Doe',
        },
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      },
      {
        id: 'version-3',
        documentId,
        content: '\\documentclass{article}\n\\begin{document}\n\\section{Introduction}\nInitial version with some additions\n\\end{document}',
        changeSize: 25,
        diffPreview: '+ \\section{Introduction}\n',
        author: {
          id: 'user_2',
          name: 'Jane Smith',
        },
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      },
      {
        id: 'version-4',
        documentId,
        content: '\\documentclass{article}\n\\begin{document}\n\\section{Introduction}\nInitial version with some additions and more content\n\\section{Methodology}\nThis section describes methodology\n\\end{document}',
        changeSize: 87,
        diffPreview: '+ and more content\n+ \\section{Methodology}\n+ This section describes methodology',
        author: {
          id: 'user_1',
          name: 'John Doe',
        },
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
      },
    ];
  }

  // Helper method to get version content
  static async getVersionContent(documentId: string, versionId: string): Promise<string> {
    // In a real implementation, fetch from the database
    // For now, find in mock data
    const versions = await this.getVersionHistory(documentId);
    const version = versions.find(v => v.id === versionId);
    
    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }
    
    return version.content;
  }
  
  // Helper method to get all projects for the current user
  static async getProjects() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    try {
      // In a real implementation, fetch from the database
      // For now, return mock projects
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('owner_id', user.id);

      if (error) throw error;
      
      // Transform to Project type for frontend
      return data.map(doc => ({
        id: doc.id,
        title: doc.title || 'Untitled',
        lastModified: new Date(doc.updated_at || doc.created_at),
        owner: 'You'
      }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      // Return some mock projects if there's an error or no data
      return [
        {
          id: 'mock-1',
          title: 'Sample LaTeX Project',
          lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          owner: 'You'
        },
        {
          id: 'mock-2',
          title: 'Research Paper Draft',
          lastModified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          owner: 'You'
        },
        {
          id: 'mock-3',
          title: 'Thesis Template',
          lastModified: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          owner: 'You'
        }
      ];
    }
  }

  // Helper method to share a document with another user
  static async shareDocument(documentId: string, email: string, permission: 'view' | 'edit' = 'edit'): Promise<void> {
    try {
      console.log(`Attempting to share document ${documentId} with ${email}...`);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error('Authentication required');
      if (!user) throw new Error('User not authenticated');
      
      // First verify document exists and user has permission
      const { data: targetDoc, error: targetDocError } = await supabase
        .from('documents')
        .select('id, title')
        .eq('id', documentId)
        .eq('owner_id', user.id)
        .single();

      // Check if user is already an accepted collaborator
      const { data: existingCollaborator } = await supabase
        .from('document_collaborators')
        .select('*')
        .eq('document_id', documentId)
        .eq('email', email)
        .eq('status', 'accepted')
        .single();

      if (existingCollaborator) {
        throw new Error('User has already accepted collaboration on this document');
      }

      if (targetDocError || !targetDoc) {
        throw new Error('Document not found or you do not have permission to share it');
      }
      
      // Upsert collaboration record - RLS will handle permission checks
      const { error: upsertError } = await supabase
        .from('document_collaborators')
        .upsert({
          document_id: documentId,
          email: email,
          permission: permission,
          status: 'pending',
          user_id: null // Will be set when user accepts invitation
        }, {
          onConflict: 'document_id,email',
          ignoreDuplicates: false // Update if exists
        });

      if (upsertError) {
        console.error('Error upserting collaboration:', upsertError);
        if (upsertError.code === '42501') { // Permission denied
          throw new Error('You do not have permission to share this document');
        } else {
          throw new Error(`Failed to share document: ${upsertError.message}`);
        }
      }

      // Get document title for email
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('title')
        .eq('id', documentId)
        .single();

      if (docError) {
        console.error('Error fetching document title:', docError);
        // Don't throw here, we can still proceed with a generic title
      }

      // Send invitation email using Edge Function
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-invitation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            documentId,
            email,
            documentTitle: document?.title || 'Untitled Document',
            invitedBy: user.email
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Edge Function error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        // Even if email fails, the sharing is still set up
        console.warn('Document shared but invitation email failed to send');
        
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.message || 'Shared successfully but failed to send invitation email');
        } catch (e) {
          throw new Error(`Shared successfully but failed to send invitation email: ${response.statusText}`);
        }
      }

      console.log(`Document shared with ${email} and invitation email sent`);
    } catch (error) {
      console.error('Error in shareDocument:', error);
      throw error instanceof Error ? error : new Error('An unknown error occurred while sharing the document');
    }
  }

  // Helper method to remove a collaborator from a document
  static async removeCollaborator(documentId: string, email: string): Promise<void> {
    try {
      // Call Edge Function to handle removal and user deletion
      const { error } = await supabase.functions.invoke('send-invitation', {
        body: {
          documentId,
          email,
          action: 'remove'
        }
      });

      if (error) {
        console.error('Error removing collaborator:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in removeCollaborator:', error);
      throw error;
    }
  }

  // Helper method to get document collaborators
  static async getCollaborators(documentId: string): Promise<Collaborator[]> {
    try {
      // First verify document exists and user has permission
      const { data: targetDoc, error: targetDocError } = await supabase
        .from('documents')
        .select('id')
        .eq('id', documentId)
        .single();

      if (targetDocError || !targetDoc) {
        throw new Error('Document not found or you do not have permission to access it');
      }

      // Then get collaborators
      const { data, error } = await supabase
        .from('document_collaborators')
        .select('*')
        .eq('document_id', documentId);

      if (error) throw error;
      return data.map(collab => ({
        id: `${collab.document_id}-${collab.email}`,
        email: collab.email,
        permission: collab.permission,
        status: collab.status,
        userId: collab.user_id
      }));
    } catch (error) {
      console.error('Error fetching collaborators:', error);
      throw error;
    }
  }

  // Helper method to create a new project
  static async createProject(title: string) {
    const initialContent = '\\documentclass{article}\n\n\\begin{document}\nHello, LaTeX!\n\\end{document}';
    return this.createDocument(title, initialContent);
  }
}
