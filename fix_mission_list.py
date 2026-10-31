import re

file_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/rescue/RescueMissionListScreen.kt"
with open(file_path, "r") as f:
    content = f.read()

# Replace factory = com.example.bai1.AppViewModelProvider.Factory
content = content.replace("factory = com.example.bai1.AppViewModelProvider.Factory", "factory = com.example.bai1.presentation.location.CurrentLocationViewModel.factory(androidx.compose.ui.platform.LocalContext.current)")

with open(file_path, "w") as f:
    f.write(content)

