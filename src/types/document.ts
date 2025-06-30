export interface Document {
  id: string;
  content: string;
  title: string;
  userId: string;
  created_at: string;
  updated_at: string;
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
