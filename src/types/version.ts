export interface DocumentVersion {
  id: string;
  document_id: string;
  content: string;
  created_at: string;
  created_by: string;
  message?: string;
}

export interface VersionMetadata {
  id: string;
  document_id: string;
  created_at: string;
  created_by: string;
  message?: string;
}
