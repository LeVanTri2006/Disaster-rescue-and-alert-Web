import os

file_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/auth/LoginScreen.kt"

with open(file_path, "r") as f:
    content = f.read()

# Replace the Google Sign-in block
old_block = """                        val getGoogleIdOptionBuilder = GetGoogleIdOption.Builder()
                            .setServerClientId(context.getString(R.string.default_web_client_id))
                            .setNonce(hashedNonce)
                            .setAutoSelectEnabled(true)

                        var credentialResponse: androidx.credentials.GetCredentialResponse? = null
                        
                        try {
                            // 1. Try with filterByAuthorizedAccounts(true)
                            val googleIdOption = getGoogleIdOptionBuilder
                                .setFilterByAuthorizedAccounts(true)
                                .build()
                                
                            val request = GetCredentialRequest.Builder()
                                .addCredentialOption(googleIdOption)
                                .build()
                            
                            credentialResponse = credentialManager.getCredential(context, request)
                        } catch (e: NoCredentialException) {
                            Log.d("GOOGLE_STEP", "No authorized accounts found, falling back to false")
                        } catch (e: GetCredentialCustomException) {
                            Log.d("GOOGLE_STEP", "CustomCredentialException on authorized accounts, falling back to false")
                        } catch (e: GetCredentialCancellationException) {
                            Log.d("GOOGLE_STEP", "User cancelled during authorized accounts check")
                            return@launch
                        } catch (e: Exception) {
                            Log.d("GOOGLE_STEP", "Other exception: ${e.message}")
                            // Fallback
                        }

                        if (credentialResponse == null) {
                            try {
                                // 2. Try with filterByAuthorizedAccounts(false)
                                val googleIdOption = getGoogleIdOptionBuilder
                                    .setFilterByAuthorizedAccounts(false)
                                    .build()
                                    
                                val request = GetCredentialRequest.Builder()
                                    .addCredentialOption(googleIdOption)
                                    .build()
                                    
                                credentialResponse = credentialManager.getCredential(context, request)
                            } catch (e: GetCredentialCancellationException) {
                                Log.d("GOOGLE_STEP", "User cancelled during all accounts check")
                                return@launch
                            } catch (e: Exception) {
                                Log.d("GOOGLE_STEP", "Exception during all accounts check: ${e.message}")
                                e.printStackTrace()
                                return@launch
                            }
                        }"""

new_block = """                        val getGoogleIdOptionBuilder = GetGoogleIdOption.Builder()
                            .setServerClientId(context.getString(R.string.default_web_client_id))
                            .setNonce(hashedNonce)
                            .setAutoSelectEnabled(false) // Never auto-select to allow switching accounts

                        var credentialResponse: androidx.credentials.GetCredentialResponse? = null
                        
                        try {
                            val googleIdOption = getGoogleIdOptionBuilder
                                .setFilterByAuthorizedAccounts(false) // Show all accounts on the device
                                .build()
                                
                            val request = GetCredentialRequest.Builder()
                                .addCredentialOption(googleIdOption)
                                .build()
                            
                            credentialResponse = credentialManager.getCredential(context, request)
                        } catch (e: GetCredentialCancellationException) {
                            Log.d("GOOGLE_STEP", "User cancelled during all accounts check")
                            return@launch
                        } catch (e: Exception) {
                            Log.d("GOOGLE_STEP", "Exception during all accounts check: ${e.message}")
                            e.printStackTrace()
                            return@launch
                        }"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(file_path, "w") as f:
        f.write(content)
    print("Patched LoginScreen.kt successfully")
else:
    print("Could not find the target block in LoginScreen.kt")
