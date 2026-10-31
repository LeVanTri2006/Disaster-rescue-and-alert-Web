sed -i 's/suspend fun resetPasswordFirebase/suspend fun verifyOtp(identifier: String, otp: String): AuthApiResult<Unit>\n    suspend fun resetPasswordFirebase/' ./bai1_copy/app/src/main/java/com/example/bai1/auth/network/AuthApiClient.kt

cat << 'INNER_EOF' >> update_api_client.patch
--- ./bai1_copy/app/src/main/java/com/example/bai1/auth/network/AuthApiClient.kt
+++ ./bai1_copy/app/src/main/java/com/example/bai1/auth/network/AuthApiClient.kt
@@ -148,6 +148,15 @@
             parser = {}
         )
 
+    override suspend fun verifyOtp(identifier: String, otp: String): AuthApiResult<Unit> =
+        executeJson(
+            method = "POST",
+            path = "/auth/verify-otp",
+            body = "{" +
+                "\"identifier\":\"${escapeJson(identifier)}\"," +
+                "\"otp\":\"${escapeJson(otp)}\"" +
+                "}",
+            parser = {}
+        )
+
     override suspend fun resetPasswordFirebase(firebaseIdToken: String, newPassword: String): AuthApiResult<Unit> =
INNER_EOF
patch -p0 < update_api_client.patch

cat << 'INNER_EOF' >> update_repo.patch
--- ./bai1_copy/app/src/main/java/com/example/bai1/auth/AuthRepository.kt
+++ ./bai1_copy/app/src/main/java/com/example/bai1/auth/AuthRepository.kt
@@ -19,6 +19,7 @@
     suspend fun login(identifier: String, password: String): Result<AuthTokens>
     suspend fun register(request: RegisterRequest): Result<AuthTokens>
     suspend fun forgotPassword(identifier: String): Result<Unit>
+    suspend fun verifyOtp(identifier: String, otp: String): Result<Unit>
     suspend fun resetPassword(identifier: String, otp: String, newPassword: String): Result<Unit>
     suspend fun resetPasswordFirebase(firebaseIdToken: String, newPassword: String): Result<Unit>
     fun logout()
@@ -52,6 +53,10 @@
         return apiResultToResult { apiClient.forgotPassword(identifier) }
     }
 
+    override suspend fun verifyOtp(identifier: String, otp: String): Result<Unit> {
+        return apiResultToResult { apiClient.verifyOtp(identifier, otp) }
+    }
+
     override suspend fun resetPassword(identifier: String, otp: String, newPassword: String): Result<Unit> {
         return apiResultToResult { apiClient.resetPassword(identifier, otp, newPassword) }
     }
INNER_EOF
patch -p0 < update_repo.patch

cat << 'INNER_EOF' >> update_vm.patch
--- ./bai1_copy/app/src/main/java/com/example/bai1/auth/AuthViewModel.kt
+++ ./bai1_copy/app/src/main/java/com/example/bai1/auth/AuthViewModel.kt
@@ -59,6 +59,12 @@
         }
     }
 
+    fun verifyOtp(identifier: String, otp: String, onResult: (Result<Unit>) -> Unit) {
+        viewModelScope.launch {
+            onResult(repository.verifyOtp(identifier, otp))
+        }
+    }
+
     fun resetPassword(identifier: String, otp: String, newPassword: String, onResult: (Result<Unit>) -> Unit) {
         viewModelScope.launch {
             onResult(repository.resetPassword(identifier, otp, newPassword))
INNER_EOF
patch -p0 < update_vm.patch
