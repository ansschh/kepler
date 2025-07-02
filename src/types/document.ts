export interface Document {
  id: string;
  content: string;
  title: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  collaborators?: DocumentCollaborator[];
}

export interface DocumentCollaborator {
  document_id: string;
  email: string;
  permission: 'view' | 'edit';
  status: 'pending' | 'accepted';
  user_id?: string;
  created_at: string;
}

export interface DocumentUpdate {
  type: 'insert' | 'delete' | 'replace';
  from: number;
  to: number;
  text: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  content: string;
  changeSize: number;
  diffPreview?: string;
  author?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  created_at: string;
}
