import re

file_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/rescue/network/RescueMissionApiClient.kt"
with open(file_path, "r") as f:
    content = f.read()

# I will replace the execute().use block of updateMissionStatus
old_block = """            client.newCall(httpRequest).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext RescueMissionApiResult.Failure(RescueMissionApiError(errorKind(response.code), "HTTP ${response.code}"))
                }
                RescueMissionApiResult.Success(Unit)
            }"""

new_block = """            client.newCall(httpRequest).execute().use { response ->
                val responseText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@withContext RescueMissionApiResult.Failure(RescueMissionApiError(errorKind(response.code), "HTTP ${response.code}"))
                }
                val jsonObject = org.json.JSONObject(if(responseText.isEmpty()) "{}" else responseText)
                val dataObj = if (jsonObject.has("data")) jsonObject.getJSONObject("data") else jsonObject
                RescueMissionApiResult.Success(parseMission(dataObj))
            }"""

content = content.replace(old_block, new_block)

with open(file_path, "w") as f:
    f.write(content)

