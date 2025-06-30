"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Template, TemplateCategory } from '@/types/template';
import { TemplateService } from '@/lib/templates';

export default function TemplateGallery() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const categories: TemplateCategory[] = ['article', 'report', 'presentation', 'thesis', 'letter', 'other'];

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        await TemplateService.initializeTemplates(); // Initialize default templates
        const templates = await TemplateService.listTemplates(selectedCategory);
        setTemplates(templates);
      } catch (error) {
        console.error('Error loading templates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, [selectedCategory]);

  const handleTemplateSelect = async (templateId: string) => {
    try {
      const documentId = await TemplateService.createFromTemplate(templateId, 'Untitled');
      router.push(`/documents/${documentId}`);
    } catch (error) {
      console.error('Error creating document from template:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Template Gallery</h1>
        <Button onClick={() => router.push('/')}>New Blank Document</Button>
      </div>

      <div className="flex gap-8">
        {/* Category sidebar */}
        <div className="w-64">
          <h2 className="text-lg font-semibold mb-4">Categories</h2>
          <div className="flex flex-col gap-2">
            <Button
              variant={!selectedCategory ? "default" : "ghost"}
              onClick={() => setSelectedCategory(undefined)}
            >
              All Templates
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "ghost"}
                onClick={() => setSelectedCategory(category)}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Template grid */}
        <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="p-6 hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-semibold mb-2">{template.name}</h3>
                <p className="text-gray-600 mb-4">{template.description}</p>
                <Button onClick={() => handleTemplateSelect(template.id)}>
                  Use Template
                </Button>
              </Card>
            ))}
          </div>

          {templates.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              No templates found in this category.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
