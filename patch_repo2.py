import sys

file_path = '/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/sos/repository/FirebaseSosRepository.kt'
with open(file_path, 'r') as f:
    content = f.read()

old_func = """    override suspend fun getActiveSos(): List<SosRescueInfo> {
        ensureRealtimeStarted()
        return mergedEvents().filter { it.isActive() }
    }"""

new_func = """    override suspend fun getActiveSos(): List<SosRescueInfo> {
        ensureRealtimeStarted()
        val localActive = localRepository.getActiveSos()
        return merge(localActive, realtimeEvents.value.values.toList()).filter { it.isActive() }
    }"""

content = content.replace(old_func, new_func)

with open(file_path, 'w') as f:
    f.write(content)
