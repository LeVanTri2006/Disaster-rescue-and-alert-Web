#!/usr/bin/env python3
"""Patch SosAppDependencies.kt to expose apiClient as a public property."""

FILE = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/sos/SosAppDependencies.kt"

with open(FILE, "r") as f:
    content = f.read()

# Add import for SosApiClient
content = content.replace(
    "import com.example.bai1.sos.network.OkHttpSosApiClient",
    "import com.example.bai1.sos.network.OkHttpSosApiClient\nimport com.example.bai1.sos.network.SosApiClient"
)

# Add apiClient lateinit property after sosRepository
content = content.replace(
    """    lateinit var sosRepository: SosRepository
        private set""",
    """    lateinit var sosRepository: SosRepository
        private set

    lateinit var apiClient: SosApiClient
        private set"""
)

# Change local val to assign to the property
content = content.replace(
    "        val apiClient = OkHttpSosApiClient(BuildConfig.SOS_API_BASE_URL, tokenProvider)",
    "        apiClient = OkHttpSosApiClient(BuildConfig.SOS_API_BASE_URL, tokenProvider)"
)

with open(FILE, "w") as f:
    f.write(content)

print("SosAppDependencies.kt patched successfully")
