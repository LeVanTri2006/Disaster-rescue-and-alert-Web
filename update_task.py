import re

def update_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace("- [ ] Task 2B: Android lưu và đồng bộ photoUrl", "- [x] Task 2B: Android lưu và đồng bộ photoUrl")
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {path}")

update_file("/home/vantri/.gemini/antigravity-ide/brain/cd070661-228c-4c6f-ba21-fbc9f11586b7/task.md")
