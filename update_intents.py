import re

file_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/rescue/MissionDetailScreen.kt"
with open(file_path, "r") as f:
    content = f.read()

imports = """import androidx.compose.material3.*
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.platform.LocalContext"""

content = content.replace("import androidx.compose.material3.*", imports)

context_decl = """) {
    val context = LocalContext.current
    var selectedTabIndex by remember { mutableIntStateOf(0) }"""
    
content = content.replace(") {\n    var selectedTabIndex by remember { mutableIntStateOf(0) }", context_decl)


map_btn_old = """                            Button(
                                onClick = {},
                                shape = RoundedCornerShape(8.dp),"""

map_btn_new = """                            Button(
                                onClick = {
                                    val lat = selectedMission?.request?.latitude
                                    val lng = selectedMission?.request?.longitude
                                    if (lat != null && lng != null) {
                                        val uri = Uri.parse("google.navigation:q=$lat,$lng")
                                        val mapIntent = Intent(Intent.ACTION_VIEW, uri)
                                        mapIntent.setPackage("com.google.android.apps.maps")
                                        try {
                                            context.startActivity(mapIntent)
                                        } catch (e: Exception) {
                                            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                                        }
                                    }
                                },
                                shape = RoundedCornerShape(8.dp),"""

content = content.replace(map_btn_old, map_btn_new)


call_btn_old = """                            OutlinedButton(
                                onClick = {},
                                modifier = Modifier.weight(1f).height(44.dp),"""
                                
call_btn_new = """                            OutlinedButton(
                                onClick = {
                                    val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:0987654321")) // Mock phone
                                    context.startActivity(intent)
                                },
                                modifier = Modifier.weight(1f).height(44.dp),"""
                                
content = content.replace(call_btn_old, call_btn_new)

with open(file_path, "w") as f:
    f.write(content)

