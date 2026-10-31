import re

with open("/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/rescue/RescueMissionListScreen.kt", "r") as f:
    content = f.read()

# Add Lifecycle imports if not present
if "import androidx.lifecycle.LifecycleEventObserver" not in content:
    content = content.replace("import androidx.compose.runtime.*", "import androidx.compose.runtime.*\nimport androidx.lifecycle.Lifecycle\nimport androidx.lifecycle.LifecycleEventObserver\nimport androidx.compose.ui.platform.LocalLifecycleOwner")

lifecycle_code = """    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.loadMissions()
                if (locationState is com.example.bai1.sos.presentation.LocationUiState.Success) {
                    val loc = locationState as com.example.bai1.sos.presentation.LocationUiState.Success
                    viewModel.loadNearbyRequests(loc.latitude, loc.longitude, 50000)
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    val processingMissions"""

content = content.replace("    val processingMissions", lifecycle_code)

with open("/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/rescue/RescueMissionListScreen.kt", "w") as f:
    f.write(content)
