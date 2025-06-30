import requests
import base64

def test_latex_compilation():
    # Test LaTeX document
    latex_content = r"""
\documentclass{article}
\begin{document}
Hello, World! This is a test document.
\end{document}
"""

    # Send POST request to compile endpoint
    url = "https://latex-compiler-v2-58035328212.us-central1.run.app/compile"
    data = {
        'tex_content': latex_content,
        'accept': 'application/pdf'
    }
    
    print("Sending compilation request...")
    try:
        response = requests.post(url, data=data)
        print(f"Response status code: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"Error response: {response.text}")
            return
            
        if response.headers.get('Content-Type') == 'application/pdf':
            print("Success! Received PDF response")
            # Save the PDF
            with open('test_output.pdf', 'wb') as f:
                f.write(response.content)
            print(f"PDF saved to test_output.pdf (size: {len(response.content)} bytes)")
        else:
            print("Received non-PDF response:")
            print(f"Content type: {response.headers.get('Content-Type')}")
            print(f"Response content: {response.text}")
    except Exception as e:
        print(f"Error during request: {str(e)}")

if __name__ == "__main__":
    test_latex_compilation()
