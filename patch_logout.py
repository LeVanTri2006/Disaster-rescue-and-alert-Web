import os

file_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/navigation/AppNavGraph.kt"

with open(file_path, "r") as f:
    content = f.read()

# Add imports
if "import androidx.credentials.CredentialManager" not in content:
    imports = """import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.credentials.CredentialManager
import androidx.credentials.ClearCredentialStateRequest
import kotlinx.coroutines.launch"""
    content = content.replace("import androidx.compose.runtime.getValue", "import androidx.compose.runtime.getValue\n" + imports)

# Add variables inside AppNavGraph
if "val scope = rememberCoroutineScope()" not in content:
    content = content.replace("val authState by authViewModel.state.collectAsState()",
                              "val authState by authViewModel.state.collectAsState()\n    val scope = rememberCoroutineScope()\n    val context = LocalContext.current")

# Replace onLogout block
old_logout = """                onLogout = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },"""
                
new_logout = """                onLogout = {
                    authViewModel.logout()
                    scope.launch {
                        try {
                            CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },"""

content = content.replace(old_logout, new_logout)

with open(file_path, "w") as f:
    f.write(content)

print("Patched successfully")
