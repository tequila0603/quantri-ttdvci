import re

content = open('App.tsx', 'r', encoding='utf-8').read()

def extract_block(name):
    match = re.search(r'^(?:export\s+)?(?:function\s+' + name + r'\b.*?\{|const\s+' + name + r'\s*=\s*.*?\{)', content, re.MULTILINE | re.DOTALL)
    if not match:
        return None
    
    start_idx = match.start()
    brace_start = match.end() - 1
    
    open_braces = 0
    in_string = False
    string_char = ''
    in_comment = False
    in_block_comment = False
    
    i = brace_start
    while i < len(content):
        c = content[i]
        
        if in_string:
            if c == '\\':
                i += 2
                continue
            if c == string_char:
                in_string = False
            i += 1
            continue
            
        if in_comment:
            if c == '\n':
                in_comment = False
            i += 1
            continue
            
        if in_block_comment:
            if c == '*' and i + 1 < len(content) and content[i+1] == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
            
        if c == '/' and i + 1 < len(content):
            nc = content[i+1]
            if nc == '/':
                in_comment = True
                i += 2
                continue
            elif nc == '*':
                in_block_comment = True
                i += 2
                continue
                
        if c in ['\'', '"', '`']:
            in_string = True
            string_char = c
            i += 1
            continue
            
        if c == '{':
            open_braces += 1
        elif c == '}':
            open_braces -= 1
            if open_braces == 0:
                return content[start_idx:i+1]
                
        i += 1
        
    return None

comps = ['LoginView', 'OverviewPage', 'FinancePage', 'EnterprisesPage', 'WorkforcePage', 'InfrastructurePage', 'MaintenancePage', 'MonitoringPage', 'ImportsPage', 'GlassSelect', 'Badge', 'LoadingBlock', 'EmptyBlock', 'ErrorBlock', 'PageTitle', 'PanelHeading', 'MetricCard', 'Sidebar']
for comp in comps:
    block = extract_block(comp)
    print(f'{comp}: {len(block) if block else "Not found"}')
