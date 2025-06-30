export interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  category: TemplateCategory;
  created_at: string;
}

export type TemplateCategory = 'article' | 'report' | 'presentation' | 'thesis' | 'letter' | 'other';
