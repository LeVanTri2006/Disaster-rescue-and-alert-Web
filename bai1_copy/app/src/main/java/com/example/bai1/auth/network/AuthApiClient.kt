package com.example.bai1.auth.network

import com.example.bai1.auth.session.AuthUser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit

data class AuthTokens(
    val accessToken: String,
    val refreshToken: String
)

enum class AuthApiErrorKind {
    BAD_REQUEST,
    UNAUTHORIZED,
    FORBIDDEN,
    SERVER,
    TIMEOUT,
    NO_INTERNET,
    UNKNOWN
}

data class AuthApiError(
    val kind: AuthApiErrorKind,
    val technicalReason: String
) {
    fun userMessage(): String = when (kind) {
        AuthApiErrorKind.BAD_REQUEST -> "Thông tin đăng nhập không hợp lệ."
        AuthApiErrorKind.UNAUTHORIZED -> "Email/số điện thoại hoặc mật khẩu không đúng."
        AuthApiErrorKind.FORBIDDEN -> "Tài khoản chưa được phép đăng nhập hoặc đã bị khóa."
        AuthApiErrorKind.SERVER -> "Máy chủ đang bận. Vui lòng thử lại sau."
        AuthApiErrorKind.TIMEOUT -> "Kết nối quá thời gian. Vui lòng thử lại."
        AuthApiErrorKind.NO_INTERNET -> "Không có kết nối mạng. Vui lòng kiểm tra lại."
        AuthApiErrorKind.UNKNOWN -> "Không thể đăng nhập lúc này."
    }
}

sealed interface AuthApiResult<out T> {
    data class Success<T>(val value: T) : AuthApiResult<T>
    data class Failure(val error: AuthApiError) : AuthApiResult<Nothing>
}

interface AuthApiClient {
    suspend fun login(identifier: String, password: String): AuthApiResult<AuthTokens>
    suspend fun refresh(refreshToken: String): AuthApiResult<AuthTokens>
    suspend fun me(accessToken: String): AuthApiResult<AuthUser>
    suspend fun updateRole(accessToken: String, role: String): AuthApiResult<AuthUser>
    suspend fun firebaseCustomToken(accessToken: String): AuthApiResult<String> =
        AuthApiResult.Failure(AuthApiError(AuthApiErrorKind.UNKNOWN, "Firebase auth bridge is unavailable"))
    suspend fun register(request: RegisterRequest): AuthApiResult<AuthTokens>
    suspend fun forgotPassword(identifier: String): AuthApiResult<Unit>
    suspend fun verifyOtp(identifier: String, otp: String): AuthApiResult<Unit>
    suspend fun resetPassword(identifier: String, otp: String, newPassword: String): AuthApiResult<Unit>
    suspend fun resetPasswordFirebase(firebaseIdToken: String, newPassword: String): AuthApiResult<Unit>
}

class OkHttpAuthApiClient(
    baseUrl: String,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()
) : AuthApiClient {
    private val baseUrl = baseUrl.trimEnd('/')
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    override suspend fun login(identifier: String, password: String): AuthApiResult<AuthTokens> =
        executeJson(
            method = "POST",
            path = "/auth/login",
            body = "{" +
                "\"${if (identifier.contains("@")) "email" else "phone"}\":\"${escapeJson(identifier)}\"," +
                "\"password\":\"${escapeJson(password)}\"" +
                "}",
            parser = ::parseTokens
        )

    override suspend fun refresh(refreshToken: String): AuthApiResult<AuthTokens> =
        executeJson(
            method = "POST",
            path = "/auth/refresh",
            body = "{\"refreshToken\":\"${escapeJson(refreshToken)}\"}",
            parser = ::parseTokens
        )

    override suspend fun me(accessToken: String): AuthApiResult<AuthUser> =
        executeJson(
            method = "GET",
            path = "/auth/me",
            bearerToken = accessToken,
            parser = ::parseUser
        )

    override suspend fun updateRole(accessToken: String, role: String): AuthApiResult<AuthUser> =
        executeJson(
            method = "PATCH",
            path = "/users/me/role",
            body = "{\"role\":\"${escapeJson(role)}\"}",
            bearerToken = accessToken,
            parser = ::parseUser
        )

    override suspend fun firebaseCustomToken(accessToken: String): AuthApiResult<String> =
        executeJson(
            method = "POST",
            path = "/auth/firebase-token",
            bearerToken = accessToken,
            parser = { data -> data.getString("customToken") }
        )

    override suspend fun forgotPassword(identifier: String): AuthApiResult<Unit> =
        executeJson(
            method = "POST",
            path = "/auth/forgot-password",
            body = "{\"identifier\":\"${escapeJson(identifier)}\"}",
            parser = {}
        )

    override suspend fun resetPassword(identifier: String, otp: String, newPassword: String): AuthApiResult<Unit> =
        executeJson(
            method = "POST",
            path = "/auth/reset-password",
            body = "{" +
                "\"identifier\":\"${escapeJson(identifier)}\"," +
                "\"otp\":\"${escapeJson(otp)}\"," +
                "\"newPassword\":\"${escapeJson(newPassword)}\"" +
                "}",
            parser = {}
        )

    override suspend fun verifyOtp(identifier: String, otp: String): AuthApiResult<Unit> =
        executeJson(
            method = "POST",
            path = "/auth/verify-otp",
            body = "{" +
                "\"identifier\":\"${escapeJson(identifier)}\"," +
                "\"otp\":\"${escapeJson(otp)}\"" +
                "}",
            parser = {}
        )

    override suspend fun resetPasswordFirebase(firebaseIdToken: String, newPassword: String): AuthApiResult<Unit> =
        executeJson(
            method = "POST",
            path = "/auth/reset-password-firebase",
            body = "{" +
                "\"firebaseIdToken\":\"${escapeJson(firebaseIdToken)}\"," +
                "\"newPassword\":\"${escapeJson(newPassword)}\"" +
                "}",
            parser = {}
        )

    private suspend fun <T> executeJson(
        method: String,
        path: String,
        body: String? = null,
        bearerToken: String? = null,
        parser: (JSONObject) -> T
    ): AuthApiResult<T> = withContext(Dispatchers.IO) {
        val requestBuilder = Request.Builder()
            .url(baseUrl + path)
            .header("Accept", "application/json")

        bearerToken?.takeIf { it.isNotBlank() }?.let {
            requestBuilder.header("Authorization", "Bearer $it")
        }

        if (body != null) {
            requestBuilder.header("Content-Type", "application/json")
                .method(method, body.toRequestBody(jsonMediaType))
        } else {
            requestBuilder.method(method, null)
        }

        try {
            client.newCall(requestBuilder.build()).execute().use { response ->
                val responseText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    return@withContext AuthApiResult.Failure(
                        AuthApiError(errorKind(response.code), "HTTP ${response.code}")
                    )
                }

                runCatching { parser(JSONObject(responseText).getJSONObject("data")) }
                    .fold(
                        onSuccess = { AuthApiResult.Success(it) },
                        onFailure = {
                            AuthApiResult.Failure(
                                AuthApiError(AuthApiErrorKind.UNKNOWN, "Invalid auth response")
                            )
                        }
                    )
            }
        } catch (_: SocketTimeoutException) {
            AuthApiResult.Failure(AuthApiError(AuthApiErrorKind.TIMEOUT, "Auth request timed out"))
        } catch (_: IOException) {
            AuthApiResult.Failure(AuthApiError(AuthApiErrorKind.NO_INTERNET, "Auth request could not reach server"))
        } catch (_: RuntimeException) {
            AuthApiResult.Failure(AuthApiError(AuthApiErrorKind.UNKNOWN, "Auth request failed"))
        }
    }

    private fun parseTokens(data: JSONObject): AuthTokens = AuthTokens(
        accessToken = data.getString("accessToken"),
        refreshToken = data.getString("refreshToken")
    )

    private fun parseUser(data: JSONObject): AuthUser = AuthUser(
        id = data.getString("id"),
        fullName = data.optString("fullName").takeIf { it.isNotBlank() },
        email = data.optString("email").takeIf { it.isNotBlank() },
        phone = data.optString("phone").takeIf { it.isNotBlank() },
        role = data.optString("role").takeIf { it.isNotBlank() },
        status = data.optString("status").takeIf { it.isNotBlank() },
        verificationStatus = data.optJSONObject("rescueProfile")?.optString("verificationStatus")?.takeIf { it.isNotBlank() }
    )

    private fun errorKind(code: Int): AuthApiErrorKind = when (code) {
        400 -> AuthApiErrorKind.BAD_REQUEST
        401 -> AuthApiErrorKind.UNAUTHORIZED
        403 -> AuthApiErrorKind.FORBIDDEN
        in 500..599 -> AuthApiErrorKind.SERVER
        else -> AuthApiErrorKind.UNKNOWN
    }

    private fun escapeJson(value: String): String = buildString(value.length + 8) {
        value.forEach { character ->
            when (character) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> append(character)
            }
        }
    }
}
