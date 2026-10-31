import sys
file_path = '/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/sos/repository/FirebaseSosRepository.kt'
with open(file_path, 'r') as f:
    content = f.read()

new_content = content.replace(
"""    override suspend fun getActiveSos(): List<SosRescueInfo> {
        ensureRealtimeStarted()
        val localActive = localRepository.getActiveSos()
        return merge(localActive, realtimeEvents.value.values.toList()).filter { it.isActive() }
    }""",
"""    override suspend fun getActiveSos(): List<SosRescueInfo> {
        android.util.Log.d("MAP_DEBUG", "FirebaseSosRepository.getActiveSos() called")
        try {
            ensureRealtimeStarted()
        } catch (e: Exception) {
            android.util.Log.e("MAP_DEBUG", "ensureRealtimeStarted failed", e)
        }
        val localActive = localRepository.getActiveSos()
        return merge(localActive, realtimeEvents.value.values.toList()).filter { it.isActive() }
    }""")

with open(file_path, 'w') as f:
    f.write(new_content)
