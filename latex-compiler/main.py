import os
import sys
import logging
import subprocess
import tempfile
import base64
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from typing import Dict, Optional, Any, Union

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add FastAPI type stubs for mypy
try:
    from fastapi import FastAPI  # type: ignore
    from fastapi.middleware.cors import CORSMiddleware  # type: ignore
    from fastapi.responses import JSONResponse  # type: ignore
except ImportError:
    pass  # Handle import errors gracefully

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def compile_latex(tex_content: str) -> Dict[str, Any]:
    logger.info("Starting LaTeX compilation")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        logger.info(f"Created temporary directory: {temp_dir}")
        
        # Clean and normalize LaTeX content
        tex_content = tex_content.strip()
        tex_content = tex_content.replace('\r\n', '\n').replace('\r', '\n')
        
        # Only add LaTeX structure if missing, don't modify existing commands
        if not tex_content.startswith('\documentclass'):
            logger.info("Adding missing documentclass")
            tex_content = '\documentclass{article}\n' + tex_content
        if '\begin{document}' not in tex_content:
            logger.info("Adding missing begin{document}")
            tex_content = tex_content + '\n\begin{document}\n'
        if '\end{document}' not in tex_content:
            logger.info("Adding missing end{document}")
            tex_content = tex_content + '\n\end{document}'
        
        # Write LaTeX content to file
        tex_file = os.path.join(temp_dir, "document.tex")
        try:
            with open(tex_file, "w", encoding="utf-8") as f:
                f.write(tex_content)
            logger.info(f"Wrote LaTeX content to {tex_file}")
        except Exception as e:
            logger.error(f"Failed to write LaTeX file: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to write LaTeX file: {e}")
        
        # Run pdflatex twice to resolve references
        for i in range(2):
            logger.info(f"Running pdflatex (pass {i+1}/2)")
            try:
                process = subprocess.Popen(
                    ["pdflatex", "-interaction=nonstopmode", tex_file],
                    cwd=temp_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                stdout_bytes, stderr_bytes = process.communicate()
                # Safely decode output, replacing invalid chars
                stdout = stdout_bytes.decode('utf-8', errors='replace')
                stderr = stderr_bytes.decode('utf-8', errors='replace')
                logger.info(f"pdflatex pass {i+1} completed with return code {process.returncode}")
            except Exception as e:
                logger.error(f"Failed to run pdflatex: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to run pdflatex: {e}")
        
        # Check if PDF was generated
        pdf_file = os.path.join(temp_dir, "document.pdf")
        log_file = os.path.join(temp_dir, "document.log")
        
        # Read log file if it exists
        log_content = ""
        if os.path.exists(log_file):
            try:
                with open(log_file, "r", encoding="utf-8", errors="replace") as f:
                    log_content = f.read()
                logger.info("Successfully read log file")
            except Exception as e:
                logger.error(f"Failed to read log file: {e}")
        
        if process.returncode != 0:
            logger.error("pdflatex failed with non-zero return code")
            return {
                "success": False,
                "error": log_content or stderr,
                "output": stdout
            }
        
        # Read the generated PDF
        if os.path.exists(pdf_file):
            try:
                with open(pdf_file, "rb") as f:
                    pdf_content = f.read()
                logger.info(f"Successfully read PDF file ({len(pdf_content)} bytes)")
                
                # Encode PDF to base64
                try:
                    pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
                    logger.info(f"Successfully encoded PDF to base64 (length: {len(pdf_base64)})")
                    
                    # Validate base64 string
                    try:
                        # Test decode a small sample
                        test_decode = base64.b64decode(pdf_base64[:100])
                        logger.info("Base64 validation successful")
                    except Exception as e:
                        logger.error(f"Base64 validation failed: {e}")
                        raise HTTPException(status_code=500, detail="Generated invalid base64 data")
                    
                    return {
                        "success": True,
                        "pdf": pdf_base64,
                        "log": log_content
                    }
                except Exception as e:
                    logger.error(f"Failed to encode PDF as base64: {e}")
                    raise HTTPException(status_code=500, detail=f"Failed to encode PDF: {e}")
            except Exception as e:
                logger.error(f"Failed to read PDF file: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to read PDF file: {e}")
        else:
            logger.error("PDF file was not generated")
            return {
                "success": False,
                "error": "PDF file was not generated",
                "log": log_content
            }

@app.post("/compile")
async def compile_document(tex_content: str = Form(...), accept: str = Form(None)) -> Response:
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
        
        # If client accepts PDF and compilation was successful, return PDF directly
        if accept == 'application/pdf' and result.get('success') and 'pdf' in result:
            try:
                # Get the raw PDF data
                pdf_data = base64.b64decode(result['pdf'])
                logger.info(f"Sending PDF response ({len(pdf_data)} bytes)")
                
                # Return PDF with appropriate headers
                headers = {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': 'inline',
                    **cors_headers
                }
                return Response(content=pdf_data, headers=headers)
            except Exception as e:
                logger.error(f"Failed to decode PDF for direct response: {e}")
                # Fall through to JSON response
        
        # Otherwise return JSON response
        logger.info("Sending JSON response")
        headers = {
            'Content-Type': 'application/json',
            **cors_headers
        }
        return JSONResponse(content=result, headers=headers)
    except Exception as e:
        logger.error(f"Compilation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
