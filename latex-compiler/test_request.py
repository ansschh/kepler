import requests

latex_content = '\documentclass{article}\begin{document}Hello World\end{document}'
response = requests.post(
    'https://latex-compiler-58035328212.us-central1.run.app/compile',
    data={'tex_content': latex_content},
    headers={'Content-Type': 'application/x-www-form-urlencoded'}
)
print(response.text)
