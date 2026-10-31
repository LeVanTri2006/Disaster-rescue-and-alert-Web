#!/usr/bin/env python3
"""Patch SosRescueRequestViewModel.kt to use R2SosPhotoUploader instead of FirebaseSosPhotoUploader."""

FILE = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/sos/SosRescueRequestViewModel.kt"

with open(FILE, "r") as f:
    content = f.read()

# 1. Change constructor parameter type
content = content.replace(
    "    private val photoUploader: com.example.bai1.sos.repository.FirebaseSosPhotoUploader\n) : ViewModel() {",
    "    private val photoUploader: com.example.bai1.sos.repository.R2SosPhotoUploader\n) : ViewModel() {"
)

# 2. Change factory instantiation
content = content.replace(
    "                    photoUploader = com.example.bai1.sos.repository.FirebaseSosPhotoUploader(context.applicationContext)",
    "                    photoUploader = com.example.bai1.sos.repository.R2SosPhotoUploader(context.applicationContext, SosAppDependencies.apiClient)"
)

with open(FILE, "w") as f:
    f.write(content)

print("SosRescueRequestViewModel.kt patched successfully")
