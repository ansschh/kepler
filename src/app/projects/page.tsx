"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RealtimeService } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { Project } from '@/types/project';

export default function ProjectsDashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Redirect to sign in if not authenticated
          router.push('/auth/sign-in');
          return;
        }
        
        // Fetch user's projects (mocked for now)
        // In a real app, fetch from Supabase or API
        const userProjects = await RealtimeService.getProjects();
        setProjects(userProjects);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProjects();
  }, [router]);
  
  const handleCreateProject = async () => {
    try {
      const project = await RealtimeService.createProject('Untitled Project');
      router.push(`/documents/${project.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };
  
  const handleProjectClick = (projectId: string) => {
    router.push(`/documents/${projectId}`);
  };
  
  const handleCheckboxChange = (projectId: string) => {
    setSelectedProjects(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };
  
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b p-4 bg-white">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold">Kepler</h1>
            <Badge variant="outline" className="text-xs py-0 px-2">Beta</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm">Features</Button>
            <Button variant="outline" size="sm">Templates</Button>
            <Button variant="outline" size="sm">Plans & Pricing</Button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="container mx-auto py-8 px-4">
        {/* Projects section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Left sidebar */}
          <div className="col-span-1">
            <Card className="mb-6">
              <CardContent className="pt-6">
                <Button className="w-full mb-4" onClick={handleCreateProject}>New project</Button>
                
                <nav className="space-y-1">
                  <Button variant="ghost" className="w-full justify-start font-normal text-black" asChild>
                    <div className="flex items-center">
                      <span>All projects</span>
                    </div>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start font-normal text-gray-600" asChild>
                    <div className="flex items-center">
                      <span>Your projects</span>
                    </div>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start font-normal text-gray-600" asChild>
                    <div className="flex items-center">
                      <span>Shared with you</span>
                    </div>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start font-normal text-gray-600" asChild>
                    <div className="flex items-center">
                      <span>Archived projects</span>
                    </div>
                  </Button>
                  <Button variant="ghost" className="w-full justify-start font-normal text-gray-600" asChild>
                    <div className="flex items-center">
                      <span>Trashed projects</span>
                    </div>
                  </Button>
                </nav>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">ORGANIZE TAGS</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-start text-sm font-normal" size="sm">
                  <span className="mr-2">+</span> New tag
                </Button>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="mr-2 text-red-500">●</span> h
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="mr-2 text-gray-500">⊘</span> Uncategorized
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Projects list */}
          <div className="col-span-1 md:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>All projects</CardTitle>
                <div className="flex items-center justify-between">
                  <Input 
                    placeholder="Search in all projects..." 
                    className="max-w-md" 
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox />
                      </TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Last modified</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.length > 0 ? projects.map((project) => (
                      <TableRow key={project.id} className="cursor-pointer hover:bg-gray-50" onClick={() => handleProjectClick(project.id)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedProjects.includes(project.id)}
                            onCheckedChange={() => handleCheckboxChange(project.id)}
                          />
                        </TableCell>
                        <TableCell>{project.title}</TableCell>
                        <TableCell>You</TableCell>
                        <TableCell>{formatDistanceToNow(project.lastModified)} ago</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                            <span className="sr-only">Download</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                            <span className="sr-only">Clone</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                            <span className="sr-only">Delete</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          No projects found. Create a new project to get started.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
