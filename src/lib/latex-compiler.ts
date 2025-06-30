interface CompileResult {
  success: boolean;
  pdf?: Uint8Array;
  error?: string;
  log?: string;
  output?: string;
}

export async function compileLatex(content: string): Promise<CompileResult> {
  try {
    const formData = new FormData();
    formData.append('tex_content', content);

    console.log('Sending LaTeX compilation request to:', process.env.NEXT_PUBLIC_LATEX_COMPILER_URL);
    
    // First, try to get the PDF directly as binary data
    const pdfResponse = await fetch(process.env.NEXT_PUBLIC_LATEX_COMPILER_URL + '/compile', {
      method: 'POST',
      headers: {
        'Accept': 'application/pdf'
      },
      body: formData,
    });

    // If we get a PDF response, process it directly
    if (pdfResponse.ok && pdfResponse.headers.get('content-type')?.includes('application/pdf')) {
      console.log('Received PDF response');
      const pdfBlob = await pdfResponse.blob();
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();
      const pdfData = new Uint8Array(pdfArrayBuffer);

      // Verify PDF header
      const header = new TextDecoder().decode(pdfData.slice(0, 5));
      console.log('PDF header:', header);
      
      if (!header.startsWith('%PDF-')) {
        throw new Error('Invalid PDF format');
      }

      return {
        success: true,
        pdf: pdfData,
        log: ''
      };
    }

    // If we didn't get a PDF, try to get JSON response with error details
    const response = await fetch(process.env.NEXT_PUBLIC_LATEX_COMPILER_URL + '/compile', {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HTTP error:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Received JSON response:', {
      success: result.success,
      hasError: !!result.error,
      hasLog: !!result.log
    });

    // Return the result directly from the backend
    return {
      success: result.success,
      error: result.error,
      log: result.log,
      output: result.output,
      pdf: result.pdf
    };
  } catch (error) {
    console.error('LaTeX compilation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
