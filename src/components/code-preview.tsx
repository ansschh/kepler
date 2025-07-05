"use client";

import * as React from 'react';
import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';

interface CodePreviewProps {
  content: string;
  language: string;
}

const getLanguageExtension = (language: string) => {
  switch (language.toLowerCase()) {
    case 'js':
    case 'jsx':
    case 'javascript':
      return javascript({ jsx: true });
    case 'ts':
    case 'tsx':
    case 'typescript':
      return javascript({ typescript: true });
    case 'py':
    case 'python':
      return python();
    case 'html':
      return html();
    case 'css':
      return css();
    case 'json':
      return json();
    case 'md':
    case 'markdown':
      return markdown();
    default:
      return javascript({ jsx: false }); // Default to JavaScript highlighting
  }
};

export function CodePreview({ content, language }: CodePreviewProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        getLanguageExtension(language),
        oneDark,
        EditorView.editable.of(false), // Make it read-only
        EditorState.readOnly.of(true)
      ]
    });

    const view = new EditorView({
      state,
      parent: editorRef.current
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [content, language]);

  return (
    <div ref={editorRef} className="h-full w-full overflow-auto" />
  );
}
