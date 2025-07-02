-- Update document_collaborators table to support new permission types
ALTER TABLE document_collaborators 
DROP CONSTRAINT IF EXISTS document_collaborators_permission_check;

ALTER TABLE document_collaborators 
ADD CONSTRAINT document_collaborators_permission_check 
CHECK (permission IN ('edit', 'review', 'view'));

-- Update RLS policies for documents table
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can edit their own documents" ON documents;
DROP POLICY IF EXISTS "Users can view shared documents" ON documents;
DROP POLICY IF EXISTS "Users can edit shared documents" ON documents;

-- Create new RLS policies with updated permission levels
CREATE POLICY "Users can view their own documents" ON documents
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can edit their own documents" ON documents
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can view shared documents" ON documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_collaborators
      WHERE document_collaborators.document_id = documents.id
      AND document_collaborators.user_id = auth.uid()
      AND document_collaborators.status = 'accepted'
      AND document_collaborators.permission IN ('edit', 'review', 'view')
    )
  );

CREATE POLICY "Users can edit shared documents" ON documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_collaborators
      WHERE document_collaborators.document_id = documents.id
      AND document_collaborators.user_id = auth.uid()
      AND document_collaborators.status = 'accepted'
      AND document_collaborators.permission = 'edit'
    )
  );

-- Add new policy for reviewers to add comments (if you have a comments table)
CREATE POLICY "Users can add comments to reviewed documents" ON document_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_collaborators
      WHERE document_collaborators.document_id = document_comments.document_id
      AND document_collaborators.user_id = auth.uid()
      AND document_collaborators.status = 'accepted'
      AND document_collaborators.permission IN ('edit', 'review')
    )
  );

-- Add policy for reviewers to edit their own comments
CREATE POLICY "Users can edit their own comments" ON document_comments
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM document_collaborators
      WHERE document_collaborators.document_id = document_comments.document_id
      AND document_collaborators.user_id = auth.uid()
      AND document_collaborators.status = 'accepted'
      AND document_collaborators.permission IN ('edit', 'review')
    )
  );

-- Add policy for all collaborators to view comments
CREATE POLICY "Users can view document comments" ON document_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_collaborators
      WHERE document_collaborators.document_id = document_comments.document_id
      AND document_collaborators.user_id = auth.uid()
      AND document_collaborators.status = 'accepted'
    )
  );
