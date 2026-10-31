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

mapper_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/sos/realtime/FirebaseSosEventMapper.kt"
mapper_replacements = [
    (
'''                condition = values["condition"]?.toString().orEmpty(),
                latitude = latitude,
                longitude = longitude,''',
'''                condition = values["condition"]?.toString().orEmpty(),
                photoUri = values["photoUrl"]?.toString(),
                latitude = latitude,
                longitude = longitude,'''
    )
]
update_file(mapper_path, mapper_replacements)

