import re

def update_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        if old not in content:
            print(f"Warning: Could not find '{old}' in {path}")
        content = content.replace(old, new)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {path}")

detail_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/sos/SosDetailScreen.kt"

new_image_card = '''@Composable
fun ImageCard(photoUri: String?) {
    InfoCard {
        CardHeader(icon = Icons.Filled.Image, title = "Hình ảnh từ người gửi")
        Spacer(modifier = Modifier.height(12.dp))
        if (photoUri != null && photoUri.isNotBlank()) {
            coil.compose.SubcomposeAsyncImage(
                model = photoUri,
                contentDescription = "Ảnh đính kèm SOS",
                contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFFE2E8F0)),
                loading = {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(180.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = PrimaryColor)
                    }
                },
                error = {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(180.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = SecondaryColor, modifier = Modifier.size(40.dp))
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                "Không thể tải hình ảnh",
                                fontSize = 12.sp,
                                color = SecondaryColor,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            )
        } else {
            Text(
                text = "Chưa có hình ảnh",
                fontSize = 14.sp,
                color = SecondaryColor,
                fontStyle = FontStyle.Italic,
                modifier = Modifier.padding(start = 30.dp)
            )
        }
    }
}'''

old_image_card = '''@Composable
fun ImageCard(photoUri: String?) {
    InfoCard {
        CardHeader(icon = Icons.Filled.Image, title = "Hình ảnh từ người gửi")
        Spacer(modifier = Modifier.height(12.dp))
        if (photoUri != null && photoUri.isNotBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFFE2E8F0)),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(16.dp)) {
                    Icon(Icons.Outlined.PhotoCamera, contentDescription = null, tint = SecondaryColor, modifier = Modifier.size(40.dp))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Ảnh đính kèm\\n$photoUri",
                        fontSize = 12.sp,
                        color = SecondaryColor,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            Text(
                text = "Chưa có hình ảnh",
                fontSize = 14.sp,
                color = SecondaryColor,
                fontStyle = FontStyle.Italic,
                modifier = Modifier.padding(start = 30.dp)
            )
        }
    }
}'''

detail_replacements = [
    (old_image_card, new_image_card)
]
update_file(detail_path, detail_replacements)
