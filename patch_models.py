import re

models_path = '/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/rescue/network/RescueMissionModels.kt'
client_path = '/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/rescue/network/RescueMissionApiClient.kt'

with open(models_path, 'r') as f:
    content = f.read()
if 'val sosEventId: String? = null' not in content:
    content = content.replace('val updatedAt: String? = null', 'val updatedAt: String? = null,\n    val sosEventId: String? = null')
    with open(models_path, 'w') as f:
        f.write(content)

with open(client_path, 'r') as f:
    content = f.read()

# Replace all occurrences of RescueMissionRequestInfo construction to include sosEventId
if 'sosEventId =' not in content:
    content = content.replace(
        'updatedAt = if (reqObj.has("updatedAt") && !reqObj.isNull("updatedAt")) reqObj.getString("updatedAt") else null',
        'updatedAt = if (reqObj.has("updatedAt") && !reqObj.isNull("updatedAt")) reqObj.getString("updatedAt") else null,\n                                sosEventId = if (reqObj.has("sosEventId") && !reqObj.isNull("sosEventId")) reqObj.getString("sosEventId") else null'
    )
    # The indentation above might be slightly off for different occurrences, but python regex is better.
    
    content = re.sub(
        r'(updatedAt = if \(reqObj\.has\("updatedAt"\) && !reqObj\.isNull\("updatedAt"\)\) reqObj\.getString\("updatedAt"\) else null)',
        r'\1,\n                                sosEventId = if (reqObj.has("sosEventId") && !reqObj.isNull("sosEventId")) reqObj.getString("sosEventId") else null',
        content
    )
    
    with open(client_path, 'w') as f:
        f.write(content)
