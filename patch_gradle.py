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

gradle_path = "/home/vantri/AndroidStudioProjects/bai1/app/build.gradle.kts"
gradle_replacements = [
    (
'''    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.7.3")
}''',
'''    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.7.3")
    implementation("io.coil-kt:coil-compose:2.6.0")
}'''
    )
]
update_file(gradle_path, gradle_replacements)
