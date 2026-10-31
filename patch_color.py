import re

def update_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        if old not in content:
            print(f"Warning: Could not find '{old}' in {path}")
        content = content.replace(old, new)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {path}")

detail_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/sos/SosDetailScreen.kt"

detail_replacements = [
    ("CircularProgressIndicator(color = PrimaryColor)", "CircularProgressIndicator(color = PrimaryBlue)")
]
update_file(detail_path, detail_replacements)
