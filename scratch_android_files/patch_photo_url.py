import os

file_path = '/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/sos/network/SosApiClient.kt'

with open(file_path, 'r') as f:
    content = f.read()

target = """                runCatching {
                    val data = JSONObject(responseText)
                    GetPhotoUploadUrlResponse(
                        uploadUrl = data.getString("uploadUrl"),
                        objectKey = data.getString("objectKey"),
                        expiresIn = data.getInt("expiresIn"),
                        contentType = data.getString("contentType")
                    )
                }.fold("""

replacement = """                runCatching {
                    val root = JSONObject(responseText)
                    val data = root.getJSONObject("data")
                    GetPhotoUploadUrlResponse(
                        uploadUrl = data.getString("uploadUrl"),
                        objectKey = data.getString("objectKey"),
                        expiresIn = data.getInt("expiresIn"),
                        contentType = data.getString("contentType")
                    )
                }.fold("""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, 'w') as f:
        f.write(content)
    print("PATCH SUCCESSFUL")
else:
    print("TARGET NOT FOUND")
