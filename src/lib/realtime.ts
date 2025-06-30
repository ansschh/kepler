import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Document, DocumentUpdate, DocumentVersion } from '@/types/document';

export class RealtimeService {
  private channel: RealtimeChannel | null = null;
  private documentId: string | null = null;

  constructor(
    private onUpdate: (update: DocumentUpdate) => void,
    private onError: (error: Error) => void
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

    const { data, error } = await supabase
      .from('documents')
      .insert([
        {
          title,
          content,
          owner_id: user.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Helper method to get a document
  static async getDocument(id: string): Promise<Document> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
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

  // Helper method to create a new project
  static async createProject(title: string) {
    const initialContent = '\\documentclass{article}\n\n\\begin{document}\nHello, LaTeX!\n\\end{document}';
    return this.createDocument(title, initialContent);
  }
}
