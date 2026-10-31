#!/usr/bin/env python3
"""Patch SosApiClient.kt createSos to include photoUrl in request body."""

FILE = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/sos/network/SosApiClient.kt"

with open(FILE, "r") as f:
    content = f.read()

old = '''            put("urgency", request.urgency.name)
            put("timestamp", request.timestampIso())
        }.toString().toRequestBody(jsonMediaType)'''

new = '''            put("urgency", request.urgency.name)
            put("timestamp", request.timestampIso())
            request.photoUrl?.let { put("photoUrl", it) }
        }.toString().toRequestBody(jsonMediaType)'''

content = content.replace(old, new)

with open(FILE, "w") as f:
    f.write(content)

print("createSos request body patched to include photoUrl")
