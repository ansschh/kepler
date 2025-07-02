import os
import sys
import base64
import logging
import asyncio
import tempfile
import subprocess
from typing import Dict, Any, Optional, List
from pathlib import Path
from fastapi import FastAPI, Form, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="LaTeX Compiler Service")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CompilationError(Exception):
    """Custom exception for LaTeX compilation errors"""
    def __init__(self, message: str, log: str = "", output: str = ""):
        self.message = message
        self.log = log
        self.output = output
        super().__init__(self.message)

class LatexCompiler:
    def __init__(self, temp_dir: str):
        self.temp_dir = temp_dir
        self.tex_file = os.path.join(temp_dir, "document.tex")
        self.pdf_file = os.path.join(temp_dir, "document.pdf")
        self.log_file = os.path.join(temp_dir, "document.log")
        self.aux_file = os.path.join(temp_dir, "document.aux")

    def validate_tex_content(self, content: str) -> str:
        """Validate and clean LaTeX content"""
        if not content or not content.strip():
            raise ValueError("Empty LaTeX content")
        
        # Normalize line endings
        content = content.replace('\r\n', '\n').replace('\r', '\n')
        
        # Remove any Unicode control characters
        content = ''.join(char for char in content if char >= ' ' or char in ['\n', '\t'])
        
        return content.strip()

    def ensure_document_structure(self, content: str) -> str:
        """Ensure LaTeX content has proper document structure"""
        lines = content.split('\n')
        
        # Add document class if missing
        if not any(line.strip().startswith('\\documentclass') for line in lines):
            content = '\\documentclass{article}\n' + content
        
        # Add document environment if missing
        if '\\begin{document}' not in content:
            if '\\documentclass' in content:
                # Add after documentclass and any potential preamble commands
                preamble_end = max(
                    content.rfind('\\documentclass'),
                    content.rfind('\\usepackage'),
                    content.rfind('\\newcommand')
                )
                if preamble_end != -1:
                    preamble_end = content.find('\n', preamble_end) + 1
                    content = content[:preamble_end] + '\n\\begin{document}\n' + content[preamble_end:]
            else:
                content = content + '\n\\begin{document}\n'
        
        if '\\end{document}' not in content:
            content = content + '\n\\end{document}'
        
        return content

    async def write_tex_file(self, content: str):
        """Write LaTeX content to file with proper encoding"""
        try:
            with open(self.tex_file, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info(f"Successfully wrote LaTeX content to {self.tex_file}")
        except Exception as e:
            raise CompilationError(f"Failed to write LaTeX file: {str(e)}")

    async def run_pdflatex(self) -> tuple[str, str, int | None]:
        """Run pdflatex with proper error handling"""
        try:
            process = await asyncio.create_subprocess_exec(
                "pdflatex",
                "-interaction=nonstopmode",
                "-halt-on-error",
                self.tex_file,
                cwd=self.temp_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout_bytes, stderr_bytes = await process.communicate()
            
            # Safely decode output
            stdout = stdout_bytes.decode('utf-8', errors='replace')
            stderr = stderr_bytes.decode('utf-8', errors='replace')
            
            return stdout, stderr, process.returncode
        except Exception as e:
            raise CompilationError(f"Failed to run pdflatex: {str(e)}")

    async def read_log_file(self) -> str:
        """Read and parse LaTeX log file"""
        try:
            if os.path.exists(self.log_file):
                with open(self.log_file, "r", encoding="utf-8", errors="replace") as f:
                    return f.read()
            return ""
        except Exception as e:
            logger.error(f"Failed to read log file: {e}")
            return ""

    async def read_pdf_file(self) -> bytes:
        """Read generated PDF file"""
        if not os.path.exists(self.pdf_file):
            raise CompilationError("PDF file was not generated")
            
        try:
            with open(self.pdf_file, "rb") as f:
                pdf_content = f.read()
                
            if not pdf_content:
                raise CompilationError("Generated PDF file is empty")
                
            return pdf_content
        except Exception as e:
            raise CompilationError(f"Failed to read PDF file: {str(e)}")

async def compile_latex(tex_content: str) -> Dict[str, Any]:
    """Main compilation function with proper error handling and validation"""
    with tempfile.TemporaryDirectory() as temp_dir:
        compiler = LatexCompiler(temp_dir)
        
        try:
            # Validate and clean input
            tex_content = compiler.validate_tex_content(tex_content)
            tex_content = compiler.ensure_document_structure(tex_content)
            
            # Write content to file
            await compiler.write_tex_file(tex_content)
            
            # Run pdflatex twice for references
            for i in range(2):
                stdout, stderr, returncode = await compiler.run_pdflatex()
                log_content = await compiler.read_log_file()
                
                if returncode != 0:
                    raise CompilationError(
                        "LaTeX compilation failed",
                        log=log_content,
                        output=stdout
                    )
            
            # Read the generated PDF
            pdf_content = await compiler.read_pdf_file()
            pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
            
            # Validate base64 output
            try:
                test_decode = base64.b64decode(pdf_base64[:100])
            except Exception as e:
                raise CompilationError("Generated invalid base64 data")
            
            return {
                "success": True,
                "pdf": pdf_base64,
                "log": await compiler.read_log_file()
            }
            
        except CompilationError as e:
            return {
                "success": False,
                "error": e.message,
                "log": e.log,
                "output": e.output
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "log": await compiler.read_log_file(),
                "output": ""
            }

@app.post("/compile")
async def compile_document(
    request: Request,
    tex_content: str = Form(...),
    accept: Optional[str] = Form(None)
) -> Response:
    # Check both Accept header and form data for content type preference
    accept_header = request.headers.get('Accept')
    accept = accept or accept_header
    """Endpoint for LaTeX compilation with proper response handling"""
    try:
        logger.info("Received compilation request")
        logger.info(f"Accept header: {accept}")
        
        result = await compile_latex(tex_content)
        
        # Common CORS headers
        cors_headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Accept'
        }
        
        # Return PDF directly if requested and available
        if (
            accept == 'application/pdf' and
            result.get('success') and
            'pdf' in result
        ):
            try:
                pdf_data = base64.b64decode(result['pdf'])
                logger.info(f"Sending PDF response ({len(pdf_data)} bytes)")
                
                if not pdf_data:
                    raise ValueError("Decoded PDF data is empty")
                
                return Response(
                    content=pdf_data,
                    headers={
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': 'inline',
                        'Content-Length': str(len(pdf_data)),
                        **cors_headers
                    }
                )
            except Exception as e:
                logger.error(f"Failed to send PDF response: {e}")
                # Fall through to JSON response
        
        # Return JSON response
        logger.info("Sending JSON response")
        return JSONResponse(
            content=result,
            headers={
                'Content-Type': 'application/json',
                **cors_headers
            }
        )
        
    except Exception as e:
        logger.error(f"Compilation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
