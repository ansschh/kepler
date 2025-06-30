"use client";

import { useState, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { RealtimeService } from '@/lib/realtime';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Send, Reply, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Comment {
  id: string;
  documentId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  content: string;
  lineNumber: number;
  created_at: string;
  replies?: Comment[];
}

interface CommentsData {
  byId: Record<string, Comment>;
  allIds: string[];
  byLine: Record<number, string[]>;
}

interface CommentProps {
  comment: Comment;
  onReply: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  currentUserId: string;
}

function CommentItem({ comment, onReply, onDelete, currentUserId }: CommentProps) {
  const [replyVisible, setReplyVisible] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const isCommentOwner = currentUserId === comment.userId;
  
  const handleSendReply = () => {
    if (!replyContent.trim()) return;
    
    onReply(comment.id, replyContent);
    setReplyContent('');
    setReplyVisible(false);
  };

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          {comment.userAvatarUrl && <AvatarImage src={comment.userAvatarUrl} />}
          <AvatarFallback>{comment.userName.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium text-sm">{comment.userName}</div>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                {comment.lineNumber > 0 && ` • Line ${comment.lineNumber}`}
              </div>
            </div>
            
            {isCommentOwner && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(comment.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <div className="mt-1 text-sm">
            {comment.content}
          </div>
          
          <div className="mt-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-xs"
              onClick={() => setReplyVisible(!replyVisible)}
            >
              <Reply className="h-3 w-3 mr-1" />
              {replyVisible ? 'Cancel' : 'Reply'}
            </Button>
          </div>
          
          {replyVisible && (
            <div className="mt-2">
              <Textarea 
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Type your reply..."
                className="min-h-[80px] text-sm"
              />
              <div className="flex justify-end mt-2">
                <Button 
                  size="sm" 
                  className="h-7" 
                  disabled={!replyContent.trim()}
                  onClick={handleSendReply}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Send
                </Button>
              </div>
            </div>
          )}
          
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 pl-4 border-l space-y-4">
              {comment.replies.map(reply => (
                <CommentItem 
                  key={reply.id} 
                  comment={reply} 
                  onReply={onReply} 
                  onDelete={onDelete}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CommentsPanelProps {
  documentId: string;
}

export function CommentsPanel({ documentId }: CommentsPanelProps) {
  const [comments, setComments] = useState<CommentsData>({
    byId: {},
    allIds: [],
    byLine: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [currentUserId, setCurrentUserId] = useState('user-1'); // Would come from auth in a real app

  useEffect(() => {
    const loadComments = async () => {
      try {
        setIsLoading(true);
        // In a real app, this would fetch comments from backend
        // For now, we'll use mock data
        const mockComments: Comment[] = [
          {
            id: 'comment-1',
            documentId,
            userId: 'user-2',
            userName: 'John Doe',
            content: 'Please add more details to the introduction section.',
            lineNumber: 15,
            created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            replies: [
              {
                id: 'reply-1',
                documentId,
                userId: 'user-1',
                userName: 'You',
                content: 'I will add those details in the next revision.',
                lineNumber: 15,
                created_at: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
              }
            ]
          },
          {
            id: 'comment-2',
            documentId,
            userId: 'user-1',
            userName: 'You',
            content: 'Should we cite this reference differently?',
            lineNumber: 42,
            created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          }
        ];

        const commentsData: CommentsData = {
          byId: {},
          allIds: [],
          byLine: {}
        };

        mockComments.forEach(comment => {
          commentsData.byId[comment.id] = comment;
          commentsData.allIds.push(comment.id);
          
          if (!commentsData.byLine[comment.lineNumber]) {
            commentsData.byLine[comment.lineNumber] = [];
          }
          commentsData.byLine[comment.lineNumber].push(comment.id);
        });

        setComments(commentsData);
      } catch (error) {
        console.error('Error loading comments:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load document comments."
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadComments();
  }, [documentId]);

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const newCommentObj: Comment = {
      id: `comment-${Date.now()}`,
      documentId,
      userId: currentUserId,
      userName: 'You',
      content: newComment,
      lineNumber: 0, // General comment, not tied to a specific line
      created_at: new Date().toISOString()
    };

    // In a real app, we would send this to the backend
    setComments(prev => {
      const updated = { ...prev };
      updated.byId[newCommentObj.id] = newCommentObj;
      updated.allIds = [newCommentObj.id, ...updated.allIds];
      
      if (!updated.byLine[0]) {
        updated.byLine[0] = [];
      }
      updated.byLine[0].push(newCommentObj.id);
      
      return updated;
    });
    
    setNewComment('');
    toast({
      title: "Comment Added",
      description: "Your comment has been added successfully."
    });
  };

  const handleReply = (commentId: string, content: string) => {
    // In a real app, we would send this to the backend
    const parentComment = comments.byId[commentId];
    
    if (!parentComment) return;
    
    const replyComment: Comment = {
      id: `reply-${Date.now()}`,
      documentId,
      userId: currentUserId,
      userName: 'You',
      content,
      lineNumber: parentComment.lineNumber,
      created_at: new Date().toISOString()
    };

    setComments(prev => {
      const updated = { ...prev };
      const parent = { ...updated.byId[commentId] };
      
      if (!parent.replies) {
        parent.replies = [];
      }
      
      parent.replies = [...parent.replies, replyComment];
      updated.byId[commentId] = parent;
      
      return updated;
    });
    
    toast({
      title: "Reply Added",
      description: "Your reply has been added successfully."
    });
  };

  const handleDeleteComment = (commentId: string) => {
    // In a real app, we would send this to the backend
    setComments(prev => {
      const updated = { ...prev };
      const comment = updated.byId[commentId];
      
      if (!comment) return prev;
      
      // Remove from allIds
      updated.allIds = updated.allIds.filter(id => id !== commentId);
      
      // Remove from byLine
      const lineNumber = comment.lineNumber;
      if (updated.byLine[lineNumber]) {
        updated.byLine[lineNumber] = updated.byLine[lineNumber].filter(id => id !== commentId);
      }
      
      // Remove from byId
      delete updated.byId[commentId];
      
      return updated;
    });
    
    toast({
      title: "Comment Deleted",
      description: "Comment has been removed successfully."
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <Textarea 
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[100px]"
        />
        <div className="flex justify-end mt-2">
          <Button 
            onClick={handleAddComment} 
            disabled={!newComment.trim()}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Comment
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-4 text-center">
            Loading comments...
          </div>
        ) : comments.allIds.length > 0 ? (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {comments.allIds.map(commentId => (
                <CommentItem 
                  key={commentId} 
                  comment={comments.byId[commentId]} 
                  onReply={handleReply} 
                  onDelete={handleDeleteComment}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
              <p className="mt-2 text-muted-foreground">No comments yet</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to leave a comment</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
