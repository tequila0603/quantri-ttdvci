import os
import re

files = ['frontend/src/pages/OverviewPage.tsx', 'frontend/src/pages/MonitoringPage.tsx']
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
        for m in re.finditer(r'm3/ngày', content, re.IGNORECASE):
            print(f"Found in {f}:")
            print(content[m.start()-100:m.end()+100])
