import os

files_to_fix = [
    "src/users/users.service.ts",
    "src/rescue-missions/rescue-missions.service.ts",
    "src/admin/rescue-profiles/rescue-profiles.service.ts"
]

for file_path in files_to_fix:
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            content = f.read()
        
        # In users.service.ts
        content = content.replace("updatedAt: new Date()", "updatedAt: new Date().toISOString() as any")
        
        # In rescue-missions.service.ts
        content = content.replace("acceptedAt = new Date()", "acceptedAt = new Date().toISOString() as any")
        content = content.replace("startedAt = new Date()", "startedAt = new Date().toISOString() as any")
        content = content.replace("completedAt = new Date()", "completedAt = new Date().toISOString() as any")
        
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"Fixed dates in {file_path}")
    else:
        print(f"Not found: {file_path}")
