"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings2 } from "lucide-react";

interface FormattingMenuProps {
  onInsert: (text: string) => void;
}

export function FormattingMenu({ onInsert }: FormattingMenuProps) {
  const templates = [
    {
      name: "Article",
      content: `\\documentclass{article}
\\title{Your Title Here}
\\author{Your Name Here}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
This is an introduction to your article.

\\section{Methods}
Describe your methods here.

\\section{Results}
Describe your results here.

\\section{Discussion}
Discuss your findings here.

\\section{Conclusion}
Conclude your article here.

\\end{document}`
    },
    {
      name: "Report",
      content: `\\documentclass{report}
\\title{Your Report Title}
\\author{Your Name Here}
\\date{\\today}

\\begin{document}

\\maketitle
\\tableofcontents

\\chapter{Introduction}
This is an introduction to your report.

\\chapter{Background}
Provide some background information here.

\\chapter{Methodology}
Describe your methodology here.

\\chapter{Results}
Describe your results here.

\\chapter{Discussion}
Discuss your findings here.

\\chapter{Conclusion}
Conclude your report here.

\\end{document}`
    },
    {
      name: "Beamer Presentation",
      content: `\\documentclass{beamer}
\\usetheme{Madrid}
\\usecolortheme{default}
\\title{Your Presentation Title}
\\author{Your Name Here}
\\date{\\today}

\\begin{document}

\\frame{\\titlepage}

\\begin{frame}{Outline}
  \\tableofcontents
\\end{frame}

\\section{First Section}
\\begin{frame}{First Section Title}
  Content for your first slide
\\end{frame}

\\section{Second Section}
\\begin{frame}{Second Section Title}
  Content for your second slide
\\end{frame}

\\section{Conclusion}
\\begin{frame}{Conclusion}
  Summarize your main points here
\\end{frame}

\\end{document}`
    }
  ];

  const environments = [
    {
      name: "Figure",
      content: "\\begin{figure}[h!]\n\\centering\n\\includegraphics[width=0.8\\textwidth]{filename}\n\\caption{Caption text}\n\\label{fig:label}\n\\end{figure}"
    },
    {
      name: "Table",
      content: "\\begin{table}[h!]\n\\centering\n\\caption{Caption text}\n\\label{tab:label}\n\\begin{tabular}{|c|c|c|}\n\\hline\nHeader 1 & Header 2 & Header 3 \\\\\n\\hline\nCell 1 & Cell 2 & Cell 3 \\\\\n\\hline\n\\end{tabular}\n\\end{table}"
    },
    {
      name: "Algorithm",
      content: "\\begin{algorithm}\n\\caption{Algorithm name}\n\\label{alg:label}\n\\begin{algorithmic}[1]\n\\Procedure{ProcedureName}{parameter}\n  \\State Procedure content\n\\EndProcedure\n\\end{algorithmic}\n\\end{algorithm}"
    },
    {
      name: "Equation Array",
      content: "\\begin{eqnarray}\na &=& b + c \\\\\n  &=& d + e\n\\end{eqnarray}"
    },
    {
      name: "List",
      content: "\\begin{itemize}\n\\item First item\n\\item Second item\n\\item Third item\n\\end{itemize}"
    },
    {
      name: "Enumeration",
      content: "\\begin{enumerate}\n\\item First item\n\\item Second item\n\\item Third item\n\\end{enumerate}"
    },
    {
      name: "Description",
      content: "\\begin{description}\n\\item[Term 1] Description of term 1\n\\item[Term 2] Description of term 2\n\\end{description}"
    },
  ];

  const mathFormulas = [
    {
      name: "Fraction",
      content: "\\frac{numerator}{denominator}"
    },
    {
      name: "Summation",
      content: "\\sum_{i=1}^{n} i"
    },
    {
      name: "Integral",
      content: "\\int_{a}^{b} f(x) \\, dx"
    },
    {
      name: "Limit",
      content: "\\lim_{x \\to \\infty} f(x)"
    },
    {
      name: "Matrix",
      content: "\\begin{bmatrix}\na & b \\\\\nc & d\n\\end{bmatrix}"
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings2 className="h-4 w-4" />
          <span className="sr-only">Advanced options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>Templates</DropdownMenuLabel>
        <DropdownMenuGroup>
          {templates.map((template) => (
            <DropdownMenuItem
              key={template.name}
              onClick={() => onInsert(template.content)}
            >
              {template.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel>Environments</DropdownMenuLabel>
        <DropdownMenuGroup>
          {environments.map((env) => (
            <DropdownMenuItem
              key={env.name}
              onClick={() => onInsert(env.content)}
            >
              {env.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel>Math</DropdownMenuLabel>
        <DropdownMenuGroup>
          {mathFormulas.map((formula) => (
            <DropdownMenuItem
              key={formula.name}
              onClick={() => onInsert(formula.content)}
            >
              {formula.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
