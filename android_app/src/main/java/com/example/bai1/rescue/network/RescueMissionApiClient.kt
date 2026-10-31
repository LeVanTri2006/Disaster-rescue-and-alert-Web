package com.example.bai1.rescue.network

import android.util.Log
import com.example.bai1.sos.network.AccessTokenProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit

interface RescueMissionApiClient {
    suspend fun getMyMissions(): RescueMissionApiResult<List<RescueMissionResponse>>
    suspend fun getMissionDetail(id: String): RescueMissionApiResult<RescueMissionResponse>
    suspend fun updateMissionStatus(id: String, status: String): RescueMissionApiResult<Unit>
}

class OkHttpRescueMissionApiClient(
    private val baseUrl: String,
    private val tokenProvider: AccessTokenProvider,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()
) : RescueMissionApiClient {
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    override suspend fun getMyMissions(): RescueMissionApiResult<List<RescueMissionResponse>> = withContext(Dispatchers.IO) {
        val token = tokenProvider.getAccessToken()?.trim().orEmpty()
        if (token.isEmpty()) {
            return@withContext RescueMissionApiResult.Failure(
                RescueMissionApiError(RescueMissionApiErrorKind.NO_TOKEN, "No access token available")
            )
        }

        val httpRequest = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/rescue-missions/my")
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .get()
            .build()

        try {
            client.newCall(httpRequest).execute().use { response ->
                val responseText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@withContext RescueMissionApiResult.Failure(
                        RescueMissionApiError(errorKind(response.code), "HTTP ${response.code}")
                    )
                }
                runCatching {
                    val dataArray = JSONObject(responseText).getJSONArray("data")
                    val missions = mutableListOf<RescueMissionResponse>()
                    for (i in 0 until dataArray.length()) {
                        missions.add(parseMission(dataArray.getJSONObject(i)))
                    }
                    missions
                }.fold(
                    onSuccess = { RescueMissionApiResult.Success(it) },
                    onFailure = { RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.UNKNOWN, "Invalid mission response")) }
                )
            }
        } catch (_: SocketTimeoutException) {
            RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.TIMEOUT, "Request timed out"))
        } catch (_: IOException) {
            RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.NO_INTERNET, "No internet connection"))
        } catch (_: RuntimeException) {
            RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.UNKNOWN, "Request failed"))
        }
    }

    override suspend fun getMissionDetail(id: String): RescueMissionApiResult<RescueMissionResponse> = withContext(Dispatchers.IO) {
        val token = tokenProvider.getAccessToken()?.trim().orEmpty()
        if (token.isEmpty()) {
            return@withContext RescueMissionApiResult.Failure(
                RescueMissionApiError(RescueMissionApiErrorKind.NO_TOKEN, "No access token available")
            )
        }

        val httpRequest = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/rescue-missions/$id")
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .get()
            .build()

        try {
            client.newCall(httpRequest).execute().use { response ->
                val responseText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@withContext RescueMissionApiResult.Failure(
                        RescueMissionApiError(errorKind(response.code), "HTTP ${response.code}")
                    )
                }
                runCatching {
                    parseMission(JSONObject(responseText).getJSONObject("data"))
                }.fold(
                    onSuccess = { RescueMissionApiResult.Success(it) },
                    onFailure = { RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.UNKNOWN, "Invalid mission response")) }
                )
            }
        } catch (_: SocketTimeoutException) {
            RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.TIMEOUT, "Request timed out"))
        } catch (_: IOException) {
            RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.NO_INTERNET, "No internet connection"))
        } catch (_: RuntimeException) {
            RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.UNKNOWN, "Request failed"))
        }
    }

    override suspend fun updateMissionStatus(id: String, status: String): RescueMissionApiResult<Unit> = withContext(Dispatchers.IO) {
        val token = tokenProvider.getAccessToken()?.trim().orEmpty()
        if (token.isEmpty()) {
            return@withContext RescueMissionApiResult.Failure(
                RescueMissionApiError(RescueMissionApiErrorKind.NO_TOKEN, "No access token available")
            )
        }

        val body = JSONObject().apply {
            put("status", status)
        }.toString().toRequestBody(jsonMediaType)

        val httpRequest = Request.Builder()
            .url("${baseUrl.trimEnd('/')}/rescue-missions/$id")
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .patch(body)
            .build()

        try {
            client.newCall(httpRequest).execute().use { response ->
                if (!response.isSuccessful) {
                    val responseText = response.body?.string().orEmpty()
                    var msg = "HTTP ${response.code}"
                    try { msg = JSONObject(responseText).getString("message") } catch(e: Exception){}
                    return@withContext RescueMissionApiResult.Failure(
                        RescueMissionApiError(errorKind(response.code), msg)
                    )
                }
                RescueMissionApiResult.Success(Unit)
            }
        } catch (_: SocketTimeoutException) {
            RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.TIMEOUT, "Request timed out"))
        } catch (_: IOException) {
            RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.NO_INTERNET, "No internet connection"))
        } catch (_: RuntimeException) {
            RescueMissionApiResult.Failure(RescueMissionApiError(RescueMissionApiErrorKind.UNKNOWN, "Request failed"))
        }
    }

    private fun parseMission(data: JSONObject): RescueMissionResponse {
        var requestInfo: RescueMissionRequestInfo? = null
        if (data.has("request") && !data.isNull("request")) {
            val reqObj = data.getJSONObject("request")
            var lat: Double? = null
            var lon: Double? = null
            if (reqObj.has("location") && !reqObj.isNull("location")) {
                val locObj = reqObj.getJSONObject("location")
                if (locObj.has("coordinates")) {
                    val coords = locObj.getJSONArray("coordinates")
                    if (coords.length() >= 2) {
                        lon = coords.getDouble(0)
                        lat = coords.getDouble(1)
                    }
                }
            }
            requestInfo = RescueMissionRequestInfo(
                id = reqObj.getString("id"),
                requesterId = reqObj.getString("requesterId"),
                peopleCount = reqObj.optInt("peopleCount", 1),
                urgency = reqObj.getString("urgency"),
                description = reqObj.optString("description", null),
                status = reqObj.getString("status"),
                latitude = lat,
                longitude = lon
            )
        }

        return RescueMissionResponse(
            id = data.getString("id"),
            requestId = data.getString("requestId"),
            rescuerId = if (data.has("rescuerId") && !data.isNull("rescuerId")) data.getString("rescuerId") else null,
            teamId = if (data.has("teamId") && !data.isNull("teamId")) data.getString("teamId") else null,
            status = data.getString("status"),
            notes = if (data.has("notes") && !data.isNull("notes")) data.getString("notes") else null,
            acceptedAt = if (data.has("acceptedAt") && !data.isNull("acceptedAt")) data.getString("acceptedAt") else null,
            startedAt = if (data.has("startedAt") && !data.isNull("startedAt")) data.getString("startedAt") else null,
            completedAt = if (data.has("completedAt") && !data.isNull("completedAt")) data.getString("completedAt") else null,
            request = requestInfo
        )
    }

    private fun errorKind(code: Int): RescueMissionApiErrorKind = when (code) {
        400 -> RescueMissionApiErrorKind.BAD_REQUEST
        401 -> RescueMissionApiErrorKind.UNAUTHORIZED
        403 -> RescueMissionApiErrorKind.FORBIDDEN
        404 -> RescueMissionApiErrorKind.NOT_FOUND
        in 500..599 -> RescueMissionApiErrorKind.SERVER
        else -> RescueMissionApiErrorKind.UNKNOWN
    }
}
