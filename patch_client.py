import sys

file_path = '/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/sos/network/SosApiClient.kt'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if 'Log.d' not in line and 'import android.util.Log' not in line and line.startswith('import java.io.IOException'):
        new_lines.append('import android.util.Log\n')
    new_lines.append(line)
    
    if 'override suspend fun getActiveSos(): SosApiResultList = withContext(Dispatchers.IO) {' in line:
        new_lines.append('        Log.d("MAP_DEBUG", "MAP_DEBUG_REQUEST_START")\n')
    
    if 'val responseText = response.body?.string().orEmpty()' in line:
        new_lines.append('                Log.d("MAP_DEBUG", "MAP_DEBUG_HTTP_STATUS=${response.code}")\n')
        
    if 'val dataArray = JSONObject(responseText).getJSONArray("data")' in line:
        new_lines.append('                    Log.d("MAP_DEBUG", "MAP_DEBUG_RESPONSE_COUNT=${dataArray.length()}")\n')
    
    if 'events.add(parseEvent(dataArray.getJSONObject(i)))' in line:
        new_lines.append('                        val parsed = parseEvent(dataArray.getJSONObject(i))\n')
        new_lines.append('                        Log.d("MAP_DEBUG", "MAP_DEBUG_EVENT=${parsed.eventId} STATUS=${parsed.status}")\n')
        new_lines.append('                        events.add(parsed)\n')
        # We don't append the original line
        new_lines.pop(-4) # remove the original events.add line
        
    if 'events\n' in line or (line.strip() == 'events' and '}.fold(' in lines[lines.index(line)+1]):
        new_lines.insert(-1, '                    Log.d("MAP_DEBUG", "MAP_DEBUG_PARSED_COUNT=${events.size}")\n')
        
with open(file_path, 'w') as f:
    f.writelines(new_lines)
