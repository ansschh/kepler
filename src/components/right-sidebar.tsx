"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Clock, MessageCircle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send } from "lucide-react";

interface RightSidebarProps {
  documentId: string;
  onVersionRestore: (content: string) => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

interface Comment {
  id: string;
  user: {
    name: string;
    initials: string;
  };
  time: string;
  text: string;
  line?: number;
  replies?: Comment[];
  parentId?: string;
}

interface HistoryVersion {
  id: string;
  date: string;
  time: string;
  description: string;
  user: {
    name: string;
    initials: string;
  };
}

export function RightSidebar({
  documentId,
  onVersionRestore,
  className = "",
  collapsed: propCollapsed,
  onToggleCollapse,
}: RightSidebarProps) {
  const [stateCollapsed, setStateCollapsed] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const [comments, setComments] = useState<Comment[]>([
    {
      id: "1",
      user: { name: "John Doe", initials: "JD" },
      time: "1 day ago",
      text: "Please add more details to the introduction section.",
      line: 15,
    },
    {
      id: "2",
      user: { name: "You", initials: "YO" },
      time: "about 12 hours ago",
      text: "I will add those details in the next revision.",
      line: 15,
    },
    {
      id: "3",
      user: { name: "You", initials: "YO" },
      time: "about 1 hour ago",
      text: "Should we cite this reference differently?",
      line: 42,
    },
  ]);

  const [versions, setVersions] = useState<HistoryVersion[]>([
    {
      id: "v1",
      date: "Jun 28, 2025",
      time: "15:42",
      description: "Fixed citation formatting",
      user: { name: "You", initials: "YO" },
    },
    {
      id: "v2",
      date: "Jun 27, 2025",
      time: "11:20",
      description: "Added new section on methodology",
      user: { name: "John Doe", initials: "JD" },
    },
    {
      id: "v3",
      date: "Jun 25, 2025",
      time: "09:15",
      description: "Initial document version",
      user: { name: "You", initials: "YO" },
    },
  ]);

  // controlled vs internal collapse state
  const collapsed = propCollapsed !== undefined ? propCollapsed : stateCollapsed;
  const setCollapsed = (value: boolean) => {
    if (onToggleCollapse) {
      onToggleCollapse(value);
    } else {
      setStateCollapsed(value);
    }
  };

  const handleCommentSubmit = () => {
    if (newComment.trim()) {
      setComments([
        ...comments,
        {
          id: `comment-${Date.now()}`,
          user: { name: "You", initials: "YO" },
          time: "just now",
          text: newComment.trim(),
        },
      ]);
      setNewComment("");
    }
  };

  const handleReplySubmit = (parentId: string) => {
    if (!replyText.trim()) return;
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === parentId) {
          return {
            ...c,
            replies: [
              ...(c.replies || []),
              {
                id: `reply-${Date.now()}`,
                user: { name: "You", initials: "YO" },
                time: "just now",
                text: replyText.trim(),
                parentId,
              },
            ],
          };
        }
        if (c.replies) {
          const updatedReplies = c.replies.map((r) =>
            r.id === parentId
              ? {
                  ...r,
                  replies: [
                    ...(r.replies || []),
                    {
                      id: `reply-${Date.now()}`,
                      user: { name: "You", initials: "YO" },
                      time: "just now",
                      text: replyText.trim(),
                      parentId,
                    },
                  ],
                }
              : r
          );
          return { ...c, replies: updatedReplies };
        }
        return c;
      })
    );
    setReplyText("");
    setReplyingTo(null);
  };

  const handleVersionRestoreClick = (version: HistoryVersion) => {
    alert(
      `Restoring version from ${version.date} at ${version.time}: ${version.description}`
    );
    // onVersionRestore(fetchedContent) would go here
  };

  if (collapsed) return null;

  return (
    <div className={`h-full flex flex-col bg-background border-l ${className}`}>
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b">
        <h2 className="text-sm font-medium">Document History</h2>
        <Button
          onClick={() => setCollapsed(true)}
          size="icon"
          variant="ghost"
          className="hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="history" className="h-full flex flex-col">
          {/* Tab Triggers */}
          <div className="px-3 pt-2 pb-0">
            <TabsList className="grid w-full grid-cols-2 rounded-lg shadow-sm">
              <TabsTrigger
                value="history"
                className="rounded-l-lg py-1.5 px-2 flex items-center justify-center gap-1.5"
              >
                <Clock className="h-4 w-4" />
                <span>History</span>
              </TabsTrigger>
              <TabsTrigger
                value="comments"
                className="rounded-r-lg py-1.5 px-2 flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Comments</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            {/* History Panel */}
            <TabsContent value="history" className="h-full overflow-y-auto">
              <Card className="border-0 rounded-none h-full bg-transparent">
                <CardHeader className="px-3 py-2 flex-shrink-0">
                  <CardTitle className="text-sm font-medium">
                    Version History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 px-3 overflow-y-auto">
                  <ScrollArea className="h-full pr-2">
                    <div className="space-y-2 pt-1">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="p-2 rounded-md hover:bg-muted cursor-pointer transition-colors flex items-start gap-3"
                          onClick={() => handleVersionRestoreClick(version)}
                        >
                          <Avatar className="h-8 w-8 border">
                            <AvatarFallback>
                              {version.user.initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div className="font-medium text-sm">
                                {version.user.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {version.date} at {version.time}
                              </div>
                            </div>
                            <div className="text-sm">
                              {version.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Comments Panel */}
            <TabsContent
              value="comments"
              className="h-full relative flex flex-col"
            >
              <Card className="border-0 rounded-none h-full bg-transparent flex flex-col">
                <CardHeader className="px-3 py-2 flex-shrink-0">
                  <CardTitle className="text-sm font-medium">Comments</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col relative">
                  {/* Scrollable comments */}
                  <div className="overflow-hidden absolute inset-x-0 top-0 bottom-[64px]">
                    <ScrollArea className="h-full px-3">
                      <div className="space-y-4 pt-1 pb-4">
                        {comments.map((comment) => (
                          <div key={comment.id} className="relative">
                            {comment.line !== undefined && (
                              <div className="text-xs text-muted-foreground mb-1">
                                Line {comment.line}
                              </div>
                            )}
                            <div className="flex gap-3">
                              <Avatar className="h-8 w-8 border">
                                <AvatarFallback>
                                  {comment.user.initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex justify-between">
                                  <div className="font-medium text-sm">
                                    {comment.user.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {comment.time}
                                  </div>
                                </div>
                                <div className="text-sm mt-1">
                                  {comment.text}
                                </div>

                                {/* Reply button */}
                                {replyingTo !== comment.id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-1 h-6 text-xs text-blue-500 p-0 hover:bg-transparent hover:underline"
                                    onClick={() => setReplyingTo(comment.id)}
                                  >
                                    Reply
                                  </Button>
                                )}

                                {/* Reply input */}
                                {replyingTo === comment.id && (
                                  <div className="mt-2 flex gap-2">
                                    <Textarea
                                      placeholder="Write a reply..."
                                      className="min-h-8 text-sm flex-1"
                                      value={replyText}
                                      onChange={(e) =>
                                        setReplyText(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" &&
                                          !e.shiftKey
                                        ) {
                                          e.preventDefault();
                                          handleReplySubmit(comment.id);
                                        }
                                      }}
                                    />
                                    <div className="flex flex-col gap-1">
                                      <Button
                                        size="sm"
                                        className="h-6 px-2"
                                        onClick={() =>
                                          handleReplySubmit(comment.id)
                                        }
                                        disabled={!replyText.trim()}
                                      >
                                        Reply
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 px-2"
                                        onClick={() => setReplyingTo(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Nested replies */}
                                {comment.replies && comment.replies.length > 0 && (
                                  <div className="ml-2 mt-3 space-y-3 pl-4 border-l-2 border-gray-200">
                                    {comment.replies.map((reply) => (
                                      <div
                                        key={reply.id}
                                        className="flex gap-3"
                                      >
                                        <Avatar className="h-6 w-6 border">
                                          <AvatarFallback>
                                            {reply.user.initials}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                          <div className="flex justify-between">
                                            <div className="font-medium text-sm">
                                              {reply.user.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {reply.time}
                                            </div>
                                          </div>
                                          <div className="text-sm mt-1">
                                            {reply.text}
                                          </div>

                                          {/* Reply to a reply */}
                                          {replyingTo !== reply.id && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="mt-1 h-5 text-xs text-blue-500 p-0 hover:bg-transparent hover:underline"
                                              onClick={() =>
                                                setReplyingTo(reply.id)
                                              }
                                            >
                                              Reply
                                            </Button>
                                          )}

                                          {/* Reply input under a reply */}
                                          {replyingTo === reply.id && (
                                            <div className="mt-2 flex gap-2">
                                              <Textarea
                                                placeholder="Write a reply..."
                                                className="min-h-8 text-sm flex-1"
                                                value={replyText}
                                                onChange={(e) =>
                                                  setReplyText(e.target.value)
                                                }
                                                onKeyDown={(e) => {
                                                  if (
                                                    e.key === "Enter" &&
                                                    !e.shiftKey
                                                  ) {
                                                    e.preventDefault();
                                                    handleReplySubmit(reply.id);
                                                  }
                                                }}
                                              />
                                              <div className="flex flex-col gap-1">
                                                <Button
                                                  size="sm"
                                                  className="h-6 px-2"
                                                  onClick={() =>
                                                    handleReplySubmit(reply.id)
                                                  }
                                                  disabled={!replyText.trim()}
                                                >
                                                  Reply
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-6 px-2"
                                                  onClick={() =>
                                                    setReplyingTo(null)
                                                  }
                                                >
                                                  Cancel
                                                </Button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  {/* Fixed input at bottom of comments panel */}
                  <div className="absolute bottom-0 left-0 right-0 bg-background border-t">
                    <div className="p-3 flex gap-2">
                      <Textarea
                        placeholder="Add a comment..."
                        className="min-h-16 flex-1"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleCommentSubmit();
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        onClick={handleCommentSubmit}
                        disabled={!newComment.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
