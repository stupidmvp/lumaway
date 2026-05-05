import sys

def check_balance(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    stack = []
    lines = content.split('\n')
    for i, line in enumerate(lines):
        # Ignore comments
        stripped = line.strip()
        if stripped.startswith('//'):
            continue
            
        for char in line:
            if char == '{':
                stack.append(('{', i + 1))
            elif char == '}':
                if not stack:
                    print(f"Extra }} at line {i + 1}")
                else:
                    stack.pop()
    
    if stack:
        print(f"Remaining stack: {stack}")

check_balance('apps/cms/components/project-detail/CapcutTimeline.tsx')
