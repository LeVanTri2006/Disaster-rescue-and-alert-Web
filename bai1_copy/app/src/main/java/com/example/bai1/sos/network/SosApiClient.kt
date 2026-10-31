package com.example.bai1.sos.network

import android.content.Context
import com.example.bai1.auth.session.SharedPreferencesTokenStorage
import com.example.bai1.sos.domain.SosTransportMode
import com.example.bai1.sos.domain.SosUrgency
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
import java.time.Instant
import java.util.concurrent.TimeUnit

interface AccessTokenProvider {
    fun getAccessToken(): String?
}

/** Reads the access token written by the app authentication layer. */
class SharedPreferencesAccessTokenProvider(context: Context) : AccessTokenProvider {
    private val tokenStorage = SharedPreferencesTokenStorage(context)

    override fun getAccessToken(): String? = tokenStorage.getAccessToken()

    companion object {
        const val PREFERENCES_NAME = SharedPreferencesTokenStorage.PREFERENCES_NAME
        const val ACCESS_TOKEN_KEY = SharedPreferencesTokenStorage.ACCESS_TOKEN_KEY
    }
}

interface SosApiClient {
    suspend fun createSos(request: CreateSosRequest): SosApiResult
    suspend fun getActiveSos(): SosListApiResult
}

class OkHttpSosApiClient(
    baseUrl: String,
    private val tokenProvider: AccessTokenProvider,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()
) : SosApiClient {
    private val createSosUrl = baseUrl.trimEnd('/') + "/sos"
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    override suspend fun createSos(request: CreateSosRequest): SosApiResult = withContext(Dispatchers.IO) {
        val token = tokenProvider.getAccessToken()?.trim().orEmpty()
        if (token.isEmpty()) {
            return@withContext SosApiResult.Failure(
                SosApiError(SosApiErrorKind.NO_TOKEN, "No access token available")
            )
        }

        val body = JSONObject().apply {
            put("adults", request.adults)
            put("children", request.children)
            put("elderly", request.elderly)
            put("neededItems", JSONArray(request.neededItems.toList()))
            put("condition", request.condition)
            request.description?.let { put("description", it) }
            put("latitude", request.latitude)
            put("longitude", request.longitude)
            request.accuracyMeters?.let { put("accuracyMeters", it) }
            request.batteryPercent?.let { put("batteryPercent", it) }
            put("urgency", request.urgency.name)
            put("timestamp", request.timestampIso())
        }.toString().toRequestBody(jsonMediaType)

        val httpRequest = Request.Builder()
            .url(createSosUrl)
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .post(body)
            .build()

        try {
            client.newCall(httpRequest).execute().use { response ->
                val responseText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@withContext SosApiResult.Failure(
                        SosApiError(errorKind(response.code), "HTTP ${response.code}")
                    )
                }
                runCatching { parseEvent(JSONObject(responseText).getJSONObject("data")) }
                    .fold(
                        onSuccess = { SosApiResult.Success(it) },
                        onFailure = { SosApiResult.Failure(SosApiError(SosApiErrorKind.UNKNOWN, "Invalid SOS response")) }
                    )
            }
        } catch (_: SocketTimeoutException) {
            SosApiResult.Failure(SosApiError(SosApiErrorKind.TIMEOUT, "SOS request timed out"))
        } catch (_: IOException) {
            SosApiResult.Failure(SosApiError(SosApiErrorKind.NO_INTERNET, "SOS request could not reach server"))
        } catch (_: RuntimeException) {
            SosApiResult.Failure(SosApiError(SosApiErrorKind.UNKNOWN, "SOS request failed"))
        }
    }

    override suspend fun getActiveSos(): SosListApiResult = withContext(Dispatchers.IO) {
        val token = tokenProvider.getAccessToken()?.trim().orEmpty()
        if (token.isEmpty()) {
            return@withContext SosListApiResult.Failure(
                SosApiError(SosApiErrorKind.NO_TOKEN, "No access token available")
            )
        }

        val url = "$createSosUrl/active"
        val httpRequest = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .get()
            .build()

        try {
            client.newCall(httpRequest).execute().use { response ->
                val responseText = response.body?.string().orEmpty()
                android.util.Log.d("MAP_SOS_DEBUG", "request GET /sos/active HTTP_STATUS=${response.code} BODY_COUNT=${responseText.length}")
                if (!response.isSuccessful) {
                    return@withContext SosListApiResult.Failure(
                        SosApiError(errorKind(response.code), "HTTP ${response.code}")
                    )
                }
                runCatching {
                    val dataArray = JSONObject(responseText).getJSONArray("data")
                    val events = mutableListOf<SosEventResponse>()
                    for (i in 0 until dataArray.length()) {
                        events.add(parseEvent(dataArray.getJSONObject(i)))
                    }
                    android.util.Log.d("MAP_SOS_DEBUG", "EVENT_IDS=${events.map{it.eventId}} STATUSES=${events.map{it.status}}")
                    events
                }.fold(
                    onSuccess = { SosListApiResult.Success(it) },
                    onFailure = { SosListApiResult.Failure(SosApiError(SosApiErrorKind.UNKNOWN, "Invalid SOS list response")) }
                )
            }
        } catch (_: SocketTimeoutException) {
            SosListApiResult.Failure(SosApiError(SosApiErrorKind.TIMEOUT, "SOS fetch timed out"))
        } catch (_: IOException) {
            SosListApiResult.Failure(SosApiError(SosApiErrorKind.NO_INTERNET, "SOS fetch could not reach server"))
        } catch (_: RuntimeException) {
            SosListApiResult.Failure(SosApiError(SosApiErrorKind.UNKNOWN, "SOS fetch failed"))
        }
    }

    private fun parseEvent(data: JSONObject): SosEventResponse {
        val items = buildSet {
            val array = data.optJSONArray("neededItems") ?: JSONArray()
            for (index in 0 until array.length()) add(array.getString(index))
        }
        return SosEventResponse(
            eventId = data.getString("eventId"),
            adults = data.optInt("adults", 0),
            children = data.optInt("children", 0),
            elderly = data.optInt("elderly", 0),
            neededItems = items,
            condition = data.optString("condition"),
            description = data.optString("description").takeIf { it.isNotBlank() },
            latitude = data.getDouble("latitude"),
            longitude = data.getDouble("longitude"),
            accuracyMeters = data.optDouble("accuracyMeters").takeUnless { it.isNaN() }?.toFloat(),
            batteryPercent = data.optInt("batteryPercent", -1).takeIf { it >= 0 },
            createdAt = parseTimestamp(data.opt("createdAt")),
            status = data.optString("status", "ACTIVE"),
            urgency = runCatching { SosUrgency.valueOf(data.optString("urgency", "HIGH")) }
                .getOrDefault(SosUrgency.HIGH),
            transportMode = runCatching { SosTransportMode.valueOf(data.optString("transportMode", "ONLINE")) }
                .getOrDefault(SosTransportMode.ONLINE)
        )
    }

    private fun parseTimestamp(value: Any?): Long = when (value) {
        is Number -> value.toLong()
        is String -> value.toLongOrNull() ?: Instant.parse(value).toEpochMilli()
        else -> System.currentTimeMillis()
    }

    private fun errorKind(code: Int): SosApiErrorKind = when (code) {
        400 -> SosApiErrorKind.BAD_REQUEST
        401 -> SosApiErrorKind.UNAUTHORIZED
        403 -> SosApiErrorKind.FORBIDDEN
        404 -> SosApiErrorKind.NOT_FOUND
        409 -> SosApiErrorKind.CONFLICT
        in 500..599 -> SosApiErrorKind.SERVER
        else -> SosApiErrorKind.UNKNOWN
    }
}
