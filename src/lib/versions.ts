import { supabase } from './supabase';
import { DocumentVersion, VersionMetadata } from '@/types/version';

export class VersionService {
  static async createSnapshot(documentId: string, content: string, message?: string): Promise<string> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('document_versions')
      .insert([
        {
          document_id: documentId,
          content,
          created_by: user.id,
          message,
        },
      ])
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  static async listVersions(documentId: string): Promise<VersionMetadata[]> {
    const { data, error } = await supabase
      .from('document_versions')
      .select('id, document_id, created_at, created_by, message')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async getVersion(versionId: string): Promise<DocumentVersion> {
    const { data, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (error) throw error;
    return data;
  }

  static async restoreVersion(documentId: string, versionId: string): Promise<void> {
    // Get the version content
    const version = await this.getVersion(versionId);
    if (!version) throw new Error('Version not found');

    // Update the document with the version content
    const { error } = await supabase
      .from('documents')
      .update({ content: version.content })
      .eq('id', documentId);

    if (error) throw error;
  }
}
