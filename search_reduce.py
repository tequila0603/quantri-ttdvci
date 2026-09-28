import os
import re

with open('frontend/src/pages/OverviewPage.tsx', 'r', encoding='utf-8') as file:
    content = file.read()
    for m in re.finditer(r'reduce\(', content):
        snippet = content[m.start()-50:m.end()+150]
        # output to file instead of printing
        with open('reduces.txt', 'a', encoding='utf-8') as f:
            f.write(snippet + "\n---\n")

with open('frontend/src/pages/MonitoringPage.tsx', 'r', encoding='utf-8') as file:
    content = file.read()
    for m in re.finditer(r'reduce\(', content):
        snippet = content[m.start()-50:m.end()+150]
        # output to file instead of printing
        with open('reduces.txt', 'a', encoding='utf-8') as f:
            f.write(snippet + "\n---\n")
