import os
path = '/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/sos/SOSScreen.kt'
with open(path, 'r') as f:
    content = f.read()

import re
old_block = """                                detectTapGestures(
                                    onPress = {
                                        isPressing = true
                                        tryAwaitRelease()
                                        isPressing = false
                                    }
                                )"""
                                
new_block = """                                awaitEachGesture {
                                    awaitFirstDown()
                                    isPressing = true
                                    do {
                                        val event = awaitPointerEvent()
                                    } while (event.changes.any { it.pressed })
                                    isPressing = false
                                }"""

# We also need to import foundation.gestures.* if needed, but awaitEachGesture is in androidx.compose.foundation.gestures.
# SOSScreen already imports androidx.compose.foundation.gestures.detectTapGestures
# Let's import all of it.
content = content.replace('import androidx.compose.foundation.gestures.detectTapGestures', 'import androidx.compose.foundation.gestures.*')

content = content.replace(old_block, new_block)

with open(path, 'w') as f:
    f.write(content)
