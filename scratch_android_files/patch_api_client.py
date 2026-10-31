#!/usr/bin/env python3
"""Patch SosApiClient.kt to add getPhotoUploadUrl method."""

import re

FILE = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/sos/network/SosApiClient.kt"

with open(FILE, "r") as f:
    content = f.read()

# 1. Add to interface: after "suspend fun getActiveSos(): SosApiResultList"
old_interface = "    suspend fun getActiveSos(): SosApiResultList\n}"
new_interface = """    suspend fun getActiveSos(): SosApiResultList
    suspend fun getPhotoUploadUrl(request: GetPhotoUploadUrlRequest): SosPhotoUploadUrlResult
}"""
content = content.replace(old_interface, new_interface)

# 2. Add implementation method before "private fun parseEvent"
impl_method = '''    // ── R2 Photo Upload URL ─────────────────────────────────────────────────
    override suspend fun getPhotoUploadUrl(request: GetPhotoUploadUrlRequest): SosPhotoUploadUrlResult = withContext(Dispatchers.IO) {
        val token = tokenProvider.getAccessToken()?.trim().orEmpty()
        if (token.isEmpty()) {
            return@withContext SosPhotoUploadUrlResult.Failure(
                SosApiError(SosApiErrorKind.NO_TOKEN, "No access token available")
            )
        }

        val body = JSONObject().apply {
            put("contentType", request.contentType)
        }.toString().toRequestBody(jsonMediaType)

        val httpRequest = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/sos/photo/upload-url")
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .post(body)
            .build()

        try {
            client.newCall(httpRequest).execute().use { response ->
                val responseText = response.body?.string().orEmpty()
                Log.d("R2_UPLOAD", "getPhotoUploadUrl HTTP ${response.code}")
                if (!response.isSuccessful) {
                    return@withContext SosPhotoUploadUrlResult.Failure(
                        SosApiError(errorKind(response.code), "HTTP ${response.code}")
                    )
                }
                runCatching {
                    val data = JSONObject(responseText)
                    GetPhotoUploadUrlResponse(
                        uploadUrl = data.getString("uploadUrl"),
                        objectKey = data.getString("objectKey"),
                        expiresIn = data.getInt("expiresIn"),
                        contentType = data.getString("contentType")
                    )
                }.fold(
                    onSuccess = { SosPhotoUploadUrlResult.Success(it) },
                    onFailure = { SosPhotoUploadUrlResult.Failure(SosApiError(SosApiErrorKind.UNKNOWN, "Invalid upload URL response")) }
                )
            }
        } catch (_: SocketTimeoutException) {
            SosPhotoUploadUrlResult.Failure(SosApiError(SosApiErrorKind.TIMEOUT, "Upload URL request timed out"))
        } catch (_: IOException) {
            SosPhotoUploadUrlResult.Failure(SosApiError(SosApiErrorKind.NO_INTERNET, "Upload URL request could not reach server"))
        } catch (_: RuntimeException) {
            SosPhotoUploadUrlResult.Failure(SosApiError(SosApiErrorKind.UNKNOWN, "Upload URL request failed"))
        }
    }

'''

content = content.replace("    private fun parseEvent", impl_method + "    private fun parseEvent")

with open(FILE, "w") as f:
    f.write(content)

print("SosApiClient.kt patched successfully")
