import re

file_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/rescue/network/RescueMissionApiClient.kt"
with open(file_path, "r") as f:
    content = f.read()

# Fix interface
content = content.replace("suspend fun updateMissionStatus(id: String, status: String): RescueMissionApiResult<Unit>", "suspend fun updateMissionStatus(id: String, status: String): RescueMissionApiResult<RescueMissionResponse>")

# Fix first implementation
old_impl = """    override suspend fun updateMissionStatus(id: String, status: String): RescueMissionApiResult<Unit> = withContext(Dispatchers.IO) {
        val token = tokenProvider.getAccessToken()?.trim().orEmpty()
        if (token.isEmpty()) {
            return@withContext RescueMissionApiResult.Failure(
                RescueMissionApiError(RescueMissionApiErrorKind.NO_TOKEN, "No access token available")
            )
        }
        val json = JSONObject().apply { put("status", status) }
        val body = json.toString().toRequestBody("application/json".toMediaType())
        val httpRequest = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/rescue-missions/$id/status")
            .header("Authorization", "Bearer $token")
            .put(body)
            .build()
        try {
            client.newCall(httpRequest).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext RescueMissionApiResult.Failure(RescueMissionApiError(errorKind(response.code), "HTTP ${response.code}"))
                }
                RescueMissionApiResult.Success(Unit)
            }
        } catch (_: Exception) {
            RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.UNKNOWN, "Request failed"))
        }
    }"""

new_impl = """    override suspend fun updateMissionStatus(id: String, status: String): RescueMissionApiResult<RescueMissionResponse> = withContext(Dispatchers.IO) {
        val token = tokenProvider.getAccessToken()?.trim().orEmpty()
        if (token.isEmpty()) {
            return@withContext RescueMissionApiResult.Failure(
                RescueMissionApiError(RescueMissionApiErrorKind.NO_TOKEN, "No access token available")
            )
        }
        val json = JSONObject().apply { put("status", status) }
        val body = json.toString().toRequestBody("application/json".toMediaType())
        val httpRequest = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/rescue-missions/$id/status")
            .header("Authorization", "Bearer $token")
            .put(body)
            .build()
        try {
            client.newCall(httpRequest).execute().use { response ->
                val responseText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@withContext RescueMissionApiResult.Failure(RescueMissionApiError(errorKind(response.code), "HTTP ${response.code}"))
                }
                val jsonObject = JSONObject(responseText)
                val dataObj = if (jsonObject.has("data")) jsonObject.getJSONObject("data") else jsonObject
                RescueMissionApiResult.Success(parseMission(dataObj))
            }
        } catch (_: Exception) {
            RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.UNKNOWN, "Request failed"))
        }
    }"""

content = content.replace(old_impl, new_impl)

# Remove the duplicate implementation at the bottom
# It starts with "    suspend fun updateMissionStatus(missionId: String, status: String): RescueMissionApiResult<RescueMissionResponse> = withContext(Dispatchers.IO) {"
# and goes to the end of the file, just before the closing "}" of the class

duplicate_start = content.find("    suspend fun updateMissionStatus(missionId: String")
if duplicate_start != -1:
    content = content[:duplicate_start] + "}\n"

with open(file_path, "w") as f:
    f.write(content)

