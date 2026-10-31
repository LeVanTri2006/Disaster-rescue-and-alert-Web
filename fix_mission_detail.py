import re

file_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/rescue/MissionDetailScreen.kt"
with open(file_path, "r") as f:
    content = f.read()

content = content.replace("import com.example.bai1.AppViewModelProvider", "")
content = content.replace("viewModel: RescueMissionViewModel = viewModel(factory = AppViewModelProvider.Factory)", "viewModel: RescueMissionViewModel = viewModel(factory = com.example.bai1.rescue.presentation.RescueMissionViewModelFactory())")

# Fix createdAt at line 153. Actually just replace "selectedMission?.createdAt" with "selectedMission?.request?.createdAt"
content = content.replace("selectedMission?.createdAt ?: \"Vừa xong\"", "selectedMission?.request?.createdAt ?: \"Vừa xong\"")

with open(file_path, "w") as f:
    f.write(content)

