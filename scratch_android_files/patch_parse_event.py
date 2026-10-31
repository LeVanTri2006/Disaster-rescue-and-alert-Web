#!/usr/bin/env python3
"""Patch SosApiClient.kt parseEvent to include photoUrl field."""

FILE = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/sos/network/SosApiClient.kt"

with open(FILE, "r") as f:
    content = f.read()

# Add photoUrl parsing before the closing parenthesis of SosEventResponse constructor
# Insert after transportMode line
old = """            transportMode = runCatching { SosTransportMode.valueOf(data.optString("transportMode", "ONLINE")) }
                .getOrDefault(SosTransportMode.ONLINE)
        )"""

new = """            transportMode = runCatching { SosTransportMode.valueOf(data.optString("transportMode", "ONLINE")) }
                .getOrDefault(SosTransportMode.ONLINE),
            photoUrl = data.optString("photoUrl", null)
        )"""

content = content.replace(old, new)

with open(FILE, "w") as f:
    f.write(content)

print("parseEvent patched to include photoUrl")
