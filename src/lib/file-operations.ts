import { supabase } from './supabase';
import { FileNode } from '@/components/file-tree';

export interface ProjectFile {
  id: string;
  document_id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  parent_id: string | null;
  content: string | null;
  storage_path: string | null; // Path to file in storage bucket
  content_type: string | null;
  extension: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;

  // Helper function to get storage URL
  getStorageUrl?: () => Promise<string | null>;
}

export interface CreateFileParams {
  documentId: string;
  name: string;
  type: 'file' | 'directory';
  parentId?: string | null;
  content?: string | null;
  extension?: string | null;
  binaryContent?: Blob | null;
  contentType?: string | null;
}

/**
 * Converts a database ProjectFile to a FileNode for the UI
 */
export function projectFileToFileNode(file: ProjectFile): FileNode {
  return {
    id: file.id,
    name: file.name,
    type: file.type,
    extension: file.extension || undefined,
    path: file.path || '', // Add path property
    parent_id: file.parent_id || null, // Add parent_id property
    // Children will be populated separately
  };
}

/**
 * Builds a tree structure from flat list of files
 */
export function buildFileTree(files: ProjectFile[]): FileNode[] {
  const fileMap = new Map<string, FileNode>();
  const rootNodes: FileNode[] = [];
  
  // First pass: create all nodes
  files.forEach(file => {
    const node = projectFileToFileNode(file);
    fileMap.set(file.id, node);
    
    // Initialize children array for directories
    if (file.type === 'directory') {
      node.children = [];
    }
  });
  
  // Second pass: build the tree structure
  files.forEach(file => {
    const node = fileMap.get(file.id)!;
    
    if (file.parent_id === null) {
      // This is a root node
      rootNodes.push(node);
    } else {
      // This is a child node
      const parentNode = fileMap.get(file.parent_id);
      if (parentNode && parentNode.children) {
        parentNode.children.push(node);
      }
    }
  });
  
  return rootNodes;
}

/**
 * Fetches all files for a document
 */
export async function getDocumentFiles(documentId: string): Promise<FileNode[]> {
  try {
    const { data, error } = await supabase
      .from('project_files')
      .select('*')
      .eq('document_id', documentId);
      
    if (error) {
      console.error('Error fetching document files:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    return buildFileTree(data as ProjectFile[]);
  } catch (error) {
    console.error('Error in getDocumentFiles:', error);
    return [];
  }
}

/**
 * Creates a new file in the document with improved binary file handling
 * 
 * @param params The parameters for creating a file
 * @returns A FileNode representing the created file, or null if creation failed
 */
export async function createFile(
  documentId: string,
  name: string,
  type: 'file' | 'directory',
  parentId: string | null = null,
  content: string | null = null,
  extension: string | null = null,
  binaryContent: Blob | null = null,
  contentType: string | null = null
): Promise<FileNode | null> {
  try {
    // Validate inputs
    if (!name) {
      throw new Error('File name is required');
    }
    
    // Automatically determine extension if not provided
    if (!extension && name.includes('.')) {
      extension = name.split('.').pop() || null;
    }
    
    // Calculate size based on content type
    let size_bytes = 0;
    if (content) {
      size_bytes = new Blob([content]).size;
    } else if (binaryContent) {
      size_bytes = binaryContent.size;
    }

    // Get current user
    const user = (await supabase.auth.getUser()).data.user;
    
    // Check if a file with the same name already exists in the same location
    let query = supabase
      .from('project_files')
      .select('id')
      .eq('document_id', documentId)
      .eq('name', name);
      
    // Handle null parent_id separately to avoid SQL type issues
    if (parentId) {
      query = query.eq('parent_id', parentId);
    } else {
      query = query.is('parent_id', null);
    }
    
    const { data: existingFiles, error: queryError } = await query;
    
    if (queryError) {
      console.error('Error checking for existing files:', queryError);
      throw queryError;
    }
    
    if (existingFiles && existingFiles.length > 0) {
      throw new Error('A file with this name already exists in this location');
    }
    
    // Create the initial database entry
    const { data: fileData, error: insertError } = await supabase
      .from('project_files')
      .insert({
        document_id: documentId,
        name: name,
        type: type,
        parent_id: parentId,
        content: binaryContent ? null : content, // Don't store content for binary files
        extension: extension,
        content_type: contentType,
        created_by: user?.id,
        updated_by: user?.id
      })
      .select()
      .single();

    if (insertError || !fileData) {
      console.error('Error creating file record:', insertError);
      throw insertError;
    }

    // Handle binary file upload to storage if present
    let storagePath = null;
    if (binaryContent) {
      try {
        // Create a safe filename by removing special characters and spaces
        const safeFileName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
        
        // Use the file ID in the storage path for consistency
        const filePath = `${documentId}/${fileData.id}-${safeFileName}`;
        console.log('Uploading to storage with path:', filePath);
        
        // Set contentType if not provided but can be determined
        if (!contentType && binaryContent.type) {
          contentType = binaryContent.type;
        }
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(filePath, binaryContent, {
            contentType: contentType || 'application/octet-stream',
            upsert: true
          });

        if (uploadError) {
          // If storage upload fails, delete the database record we just created
          await supabase
            .from('project_files')
            .delete()
            .eq('id', fileData.id);
            
          console.error('Error uploading to storage:', uploadError);
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Update the file record with the storage path
        const { error: updateError } = await supabase
          .from('project_files')
          .update({
            storage_path: filePath
          })
          .eq('id', fileData.id);

        if (updateError) {
          console.error('Error updating storage path:', updateError);
          // Try to clean up the uploaded file
          await supabase.storage
            .from('project-files')
            .remove([filePath]);
          throw updateError;
        }

        console.log('File uploaded to storage:', filePath);
      } catch (uploadErr) {
        // Clean up the database record if anything fails
        await supabase
          .from('project_files')
          .delete()
          .eq('id', fileData.id);
          
        console.error('Binary file upload error:', uploadErr);
        throw uploadErr;
      }
    } else {
      // For non-binary files, just update the database record
      const { error: updateError } = await supabase
        .from('project_files')
        .update({
          content: content
        })
        .eq('id', fileData.id);

      if (updateError) {
        console.error('Error updating file content:', updateError);
        throw updateError;
      }
    }
    
    // Return the created file node
    return projectFileToFileNode(fileData as ProjectFile);
  } catch (error) {
    console.error('Error in createFile:', error);
    return null;
  }
}

/**
 * Updates an existing file
 */
export async function updateFile(
  fileId: string,
  updates: Partial<{
    name: string;
    content: string | null;
    binary_content: Blob | null;
    content_type: string | null;
    parent_id: string | null;
  }>
): Promise<FileNode | null> {
  try {
    // Update the file with the user ID
    const updateData = {
      ...updates,
      updated_by: (await supabase.auth.getUser()).data.user?.id,
      updated_at: new Date().toISOString()
    };
    
    // Get existing file data
    const { data: existingFile } = await supabase
      .from('project_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (!existingFile) {
      console.error('File not found:', fileId);
      return null;
    }

    // Handle binary content and size calculation
    if (updates.content !== undefined || updates.binary_content !== undefined) {
      let size_bytes = 0;
      let storagePath = null;
      
      if (updates.content) {
        size_bytes = new Blob([updates.content]).size;
      } else if (updates.binary_content) {
        size_bytes = updates.binary_content.size;
        
        // Upload binary content to storage - use simpler path construction
        const safeFileName = (updates.name || existingFile.name).replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${existingFile.document_id}/${Date.now()}-${safeFileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(filePath, updates.binary_content, {
            contentType: updates.content_type || existingFile.content_type || 'application/octet-stream',
            upsert: true
          });

        if (uploadError) {
          console.error('Error uploading to storage:', uploadError);
          return null;
        }

        storagePath = filePath;
        console.log('File uploaded to storage:', filePath);

        // Delete old file from storage if it exists
        if (existingFile.storage_path) {
          await supabase.storage
            .from('project-files')
            .remove([existingFile.storage_path]);
        }

        // Update storage path in database
        (updateData as any).storage_path = storagePath;
        // Don't store binary content in database
        delete (updateData as any).binary_content;
      }
      
      (updateData as any).size_bytes = size_bytes;
    }
    
    const { data, error } = await supabase
      .from('project_files')
      .update(updateData)
      .eq('id', fileId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating file:', error);
      return null;
    }
    
    return projectFileToFileNode(data as ProjectFile);
  } catch (error) {
    console.error('Error in updateFile:', error);
    return null;
  }
}

/**
 * Deletes a file or directory
 * If it's a directory, all children will be deleted as well (handled by DB cascade)
 */
export async function deleteFile(fileId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('project_files')
      .delete()
      .eq('id', fileId);
    
    if (error) {
      console.error('Error deleting file:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteFile:', error);
    return false;
  }
}

/**
 * Gets the content of a specific file
 */
export async function getFileContent(fileId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('project_files')
      .select('content')
      .eq('id', fileId)
      .single();
    
    if (error || !data) {
      console.error('Error fetching file content:', error);
      return null;
    }
    
    return data.content;
  } catch (error) {
    console.error('Error in getFileContent:', error);
    return null;
  }
}

/**
 * Searches for files by name
 */
export async function searchFiles(documentId: string, searchTerm: string): Promise<FileNode[]> {
  try {
    if (!searchTerm.trim()) {
      return await getDocumentFiles(documentId);
    }
    
    const { data, error } = await supabase
      .from('project_files')
      .select('*')
      .eq('document_id', documentId)
      .ilike('name', `%${searchTerm}%`);
    
    if (error) {
      console.error('Error searching files:', error);
      return [];
    }
    
    // For search results, we return a flat list rather than a tree
    return (data as ProjectFile[]).map(projectFileToFileNode);
  } catch (error) {
    console.error('Error in searchFiles:', error);
    return [];
  }
}
