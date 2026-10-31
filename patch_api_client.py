import os

base_dir = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1"
auth_api_client_path = os.path.join(base_dir, "auth", "network", "AuthApiClient.kt")

with open(auth_api_client_path, "r") as f:
    content = f.read()

# Add interface methods
if "suspend fun forgotPassword" not in content:
    content = content.replace(
        "suspend fun updateRole(accessToken: String, role: String): AuthApiResult<AuthUser>",
        "suspend fun updateRole(accessToken: String, role: String): AuthApiResult<AuthUser>\n"
        "    suspend fun forgotPassword(identifier: String): AuthApiResult<Unit>\n"
        "    suspend fun resetPassword(identifier: String, otp: String, newPassword: String): AuthApiResult<Unit>"
    )

# Add implementation methods
if "override suspend fun forgotPassword" not in content:
    new_methods = """
    override suspend fun forgotPassword(identifier: String): AuthApiResult<Unit> =
        executeJson(
            method = "POST",
            path = "/auth/forgot-password",
            body = "{\\"identifier\\":\\"${escapeJson(identifier)}\\"}",
            parser = { Unit }
        )

    override suspend fun resetPassword(identifier: String, otp: String, newPassword: String): AuthApiResult<Unit> =
        executeJson(
            method = "POST",
            path = "/auth/reset-password",
            body = "{\\"identifier\\":\\"${escapeJson(identifier)}\\",\\"otp\\":\\"${escapeJson(otp)}\\",\\"newPassword\\":\\"${escapeJson(newPassword)}\\"}",
            parser = { Unit }
        )
"""
    content = content.replace(
        "override suspend fun updateRole(",
        new_methods.strip() + "\n\n    override suspend fun updateRole("
    )

with open(auth_api_client_path, "w") as f:
    f.write(content)

print("AuthApiClient.kt updated.")
