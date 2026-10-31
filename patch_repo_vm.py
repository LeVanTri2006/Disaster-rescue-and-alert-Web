import os

base_dir = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1"

# --- Patch AuthRepository.kt ---
repo_path = os.path.join(base_dir, "auth", "AuthRepository.kt")
with open(repo_path, "r") as f:
    repo_content = f.read()

repo_new_methods = """
    suspend fun forgotPassword(identifier: String): Result<Unit> {
        return when (val result = apiClient.forgotPassword(identifier.trim())) {
            is AuthApiResult.Success -> Result.success(Unit)
            is AuthApiResult.Failure -> Result.failure(Exception(result.error.userMessage()))
        }
    }

    suspend fun resetPassword(identifier: String, otp: String, newPassword: String): Result<Unit> {
        return when (val result = apiClient.resetPassword(identifier.trim(), otp.trim(), newPassword)) {
            is AuthApiResult.Success -> Result.success(Unit)
            is AuthApiResult.Failure -> Result.failure(Exception(result.error.userMessage()))
        }
    }
"""

if "suspend fun forgotPassword" not in repo_content:
    repo_content = repo_content.replace(
        "    private suspend fun loadCurrentUserOrClear(isNewUser: Boolean = false) {",
        repo_new_methods.strip("\n") + "\n\n    private suspend fun loadCurrentUserOrClear(isNewUser: Boolean = false) {"
    )
    with open(repo_path, "w") as f:
        f.write(repo_content)
    print("AuthRepository.kt updated.")

# --- Patch AuthViewModel.kt ---
vm_path = os.path.join(base_dir, "auth", "AuthViewModel.kt")
with open(vm_path, "r") as f:
    vm_content = f.read()

vm_new_methods = """
    suspend fun forgotPassword(identifier: String): Result<Unit> {
        return repository.forgotPassword(identifier)
    }

    suspend fun resetPassword(identifier: String, otp: String, newPassword: String): Result<Unit> {
        return repository.resetPassword(identifier, otp, newPassword)
    }
"""

if "suspend fun forgotPassword" not in vm_content:
    vm_content = vm_content.replace(
        "    fun logout() {",
        vm_new_methods.strip("\n") + "\n\n    fun logout() {"
    )
    with open(vm_path, "w") as f:
        f.write(vm_content)
    print("AuthViewModel.kt updated.")
