// @deno-types="https://deno.land/std@0.168.0/http/server.ts"
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @deno-types="https://esm.sh/v128/@supabase/supabase-js@2.39.3/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface RequestBody {
  documentId: string
  email: string
  invitedBy: string
  documentTitle?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Define request body type
type RequestBody = {
  documentId: string;
  email: string;
  invitedBy: string;
  documentTitle: string;
  permission?: 'view' | 'edit';
  resend?: boolean;
  action?: 'remove';
};

// Define error response helper
const errorResponse = (error: unknown, message: string, status = 500) => {
  console.error(`${message}:`, error);
  return new Response(
    JSON.stringify({ 
      error: error instanceof Error ? error.message : message,
      details: error instanceof Error ? error.stack : undefined
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status
    }
  );
};

// Define success response helper
const successResponse = (message: string, data?: unknown) => {
  return new Response(
    JSON.stringify({ message, data }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  );
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    })
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return errorResponse(null, 'Method not allowed', 405);
  }

  // Create Supabase client
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { documentId, email, invitedBy, permission = 'edit', documentTitle, resend = false, action } = 
      await req.json() as RequestBody;

    // Validate input
    if (!documentId || !email) {
      return errorResponse(null, 'Missing required fields', 400);
    }

    // Validate permission
    if (!['edit', 'view'].includes(permission)) {
      return errorResponse(null, 'Invalid permission level. Must be one of: edit, view', 400);
    }

    try {
      // Handle removal action
      if (action === 'remove') {
        // Delete from document_collaborators first
        const { error: deleteError } = await supabaseClient
          .from('document_collaborators')
          .delete()
          .match({
            document_id: documentId,
            email: email
          });

        if (deleteError) {
          return errorResponse(deleteError, 'Failed to remove collaborator');
        }

        // Check if user exists and is pending
        const { data: existingUser } = await supabaseClient.auth.admin.listUsers();
        const user_to_delete = existingUser?.users?.find(u => u.email === email);
        
        if (user_to_delete && !user_to_delete.email_confirmed_at) {
          await supabaseClient.auth.admin.deleteUser(user_to_delete.id);
        }

        return successResponse('Collaborator removed successfully');
      }

      // Handle invitation (default action)
      // Check if user already exists
      const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);

      // If user exists and resend is true, or user exists but hasn't confirmed email
      if (existingUser) {
        if (!existingUser.email_confirmed_at || resend) {
          // Delete existing user if they haven't confirmed email
          await supabaseClient.auth.admin.deleteUser(existingUser.id);
        } else {
          // User exists and has confirmed email - just update collaborator
          const { error: insertError } = await supabaseClient
            .from('document_collaborators')
            .upsert({
              document_id: documentId,
              email: email,
              permission: permission,
              created_at: new Date().toISOString()
            });

          if (insertError) {
            return errorResponse(insertError, 'Failed to update collaborator');
          }

          return successResponse('Collaborator updated successfully');
        }
      }

      // Send invitation email
      const { data: inviteData, error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(email, {
        data: {
          document_id: documentId,
          permission: permission,
          invited_by: invitedBy,
          document_title: documentTitle
        },
        redirectTo: `${Deno.env.get('SITE_URL')}/documents/${documentId}`
      });

      if (inviteError) {
        return errorResponse(inviteError, 'Failed to send invitation');
      }

      // Add to document_collaborators
      const { error: insertError } = await supabaseClient
        .from('document_collaborators')
        .upsert({
          document_id: documentId,
          email: email,
          permission: permission,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        return errorResponse(insertError, 'Failed to create collaborator record');
      }

      return successResponse('Invitation sent successfully', { inviteData });
    } catch (error) {
      return errorResponse(error, 'Failed to process action');
    }
  } catch (error) {
    return errorResponse(error, 'Failed to process request');
  }
})