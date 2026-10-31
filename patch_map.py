import sys

file_path = '/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/map/DisasterMapScreen.kt'
with open(file_path, 'r') as f:
    content = f.read()

if 'import android.util.Log' not in content:
    content = content.replace('import androidx.compose.runtime.*', 'import androidx.compose.runtime.*\nimport android.util.Log')

old_filter = """    val activeSosEvents = sosEvents.filter { 
        it.status == SosStatus.ACTIVE || it.status == SosStatus.PENDING || it.status == SosStatus.QUEUED 
    }"""

new_filter = """    val activeSosEvents = sosEvents.filter { 
        it.status == SosStatus.ACTIVE || it.status == SosStatus.PENDING || it.status == SosStatus.QUEUED 
    }
    
    LaunchedEffect(activeSosEvents) {
        Log.d("MAP_DEBUG", "MAP_DEBUG_ACTIVE_COUNT=${activeSosEvents.size}")
        Log.d("MAP_DEBUG", "MAP_DEBUG_MARKER_COUNT=${activeSosEvents.size}")
    }"""

content = content.replace(old_filter, new_filter)

with open(file_path, 'w') as f:
    f.write(content)
