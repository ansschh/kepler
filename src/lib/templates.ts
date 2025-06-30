import { supabase } from './supabase';
import { Template, TemplateCategory } from '@/types/template';

export class TemplateService {
  static async listTemplates(category?: TemplateCategory): Promise<Template[]> {
    const query = supabase
      .from('templates')
      .select('*');

    if (category) {
      query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Template[];
  }

  static async getTemplate(id: string): Promise<Template | null> {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  static async createFromTemplate(templateId: string, title: string): Promise<string> {
    const template = await this.getTemplate(templateId);
    if (!template) throw new Error('Template not found');

    // Create a new document using the template content
    const { data, error } = await supabase
      .from('documents')
      .insert([
        {
          title,
          content: template.content,
          owner_id: (await supabase.auth.getUser()).data.user?.id,
        },
      ])
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  // Initial set of built-in templates
  static async initializeTemplates() {
    const templates = [
      {
        name: 'Basic Article',
        description: 'A simple article template with basic sections',
        content: `\\documentclass{article}
\\usepackage[utf8]{inputenc}

\\title{Your Title Here}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Your introduction goes here.

\\section{Methods}
Your methods section goes here.

\\section{Results}
Your results go here.

\\section{Discussion}
Your discussion goes here.

\\end{document}`,
        category: 'article',
      },
      {
        name: 'Beamer Presentation',
        description: 'A basic presentation using the Beamer class',
        content: `\\documentclass{beamer}
\\usetheme{Madrid}

\\title{Your Presentation Title}
\\author{Your Name}
\\institute{Your Institution}
\\date{\\today}

\\begin{document}

\\frame{\\titlepage}

\\begin{frame}
\\frametitle{First Slide}
\\begin{itemize}
  \\item First point
  \\item Second point
  \\item Third point
\\end{itemize}
\\end{frame}

\\end{document}`,
        category: 'presentation',
      },
    ];

    // Insert templates if they don't exist
    for (const template of templates) {
      const { error } = await supabase
        .from('templates')
        .upsert([template], {
          onConflict: 'name',
        });

      if (error) console.error('Error initializing template:', error);
    }
  }
}
