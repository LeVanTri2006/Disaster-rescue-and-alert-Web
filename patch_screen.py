import re

with open("/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/sos/SosDetailScreen.kt", "r") as f:
    content = f.read()

# Add LaunchedEffect import if not present
if "import androidx.compose.runtime.LaunchedEffect" not in content:
    content = content.replace("import androidx.compose.runtime.rememberCoroutineScope", "import androidx.compose.runtime.rememberCoroutineScope\nimport androidx.compose.runtime.LaunchedEffect")

# Update bottomBar call
bottom_bar_replacement = """        bottomBar = {
            if (state is SosDetailState.Success) {
                ActionBottomBar(
                    state = state as SosDetailState.Success,
                    onClick = showNotImplementedSnackbar,
                    onAccept = { viewModel.acceptMission() }
                )
            }
        },"""
content = re.sub(r'        bottomBar = \{\s*if \(state is SosDetailState\.Success\) \{\s*ActionBottomBar\(showNotImplementedSnackbar\)\s*\}\s*\},', bottom_bar_replacement, content)

# Add LaunchedEffect inside Scaffold or before Scaffold
effect_code = """    val successState = state as? SosDetailState.Success
    LaunchedEffect(successState?.acceptSuccess, successState?.acceptError) {
        if (successState?.acceptSuccess == true) {
            snackbarHostState.showSnackbar("Nhận nhiệm vụ thành công!")
            onNavigateBack()
        } else if (successState?.acceptError != null) {
            val errorMsg = if (successState.acceptError.contains("409")) "Nhiệm vụ này đã được người khác nhận." else successState.acceptError
            snackbarHostState.showSnackbar(errorMsg)
            viewModel.clearAcceptError()
        }
    }

    Scaffold("""
content = content.replace("    Scaffold(", effect_code)

# Update ActionBottomBar signature and implementation
action_bottom_bar_old = r'@Composable\nfun ActionBottomBar\(onClick: \(\) -> Unit\) \{.*'
action_bottom_bar_new = """@Composable
fun ActionBottomBar(state: SosDetailState.Success, onClick: () -> Unit, onAccept: () -> Unit) {
    Surface(
        color = Color.White,
        shadowElevation = 16.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .padding(horizontal = 16.dp, vertical = 16.dp)
                .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom))
        ) {
            if (state.isRescuer) {
                if (state.rescueRequest == null) {
                    Text("Yêu cầu cứu hộ này chưa sẵn sàng để nhận.", color = SecondaryColor, fontSize = 14.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                    Spacer(modifier = Modifier.height(12.dp))
                } else if (state.rescueRequest.status == "PENDING") {
                    Button(
                        onClick = onAccept,
                        enabled = !state.isAccepting,
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        if (state.isAccepting) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                        } else {
                            Icon(Icons.Filled.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("NHẬN NHIỆM VỤ", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                } else if (state.rescueRequest.status == "ASSIGNED") {
                    Text("Nhiệm vụ này đã có người nhận.", color = WarningOrange, fontSize = 14.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                    Spacer(modifier = Modifier.height(12.dp))
                } else {
                    Text("Nhiệm vụ đang được thực hiện hoặc đã hoàn thành.", color = SuccessGreen, fontSize = 14.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                    Spacer(modifier = Modifier.height(12.dp))
                }
            } else {
                Button(
                    onClick = onClick,
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                ) {
                    Icon(Icons.Filled.Navigation, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("CHỈ ĐƯỜNG", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
                Spacer(modifier = Modifier.height(12.dp))
            }
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onClick,
                    modifier = Modifier.weight(1f).height(48.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = PrimaryBlue),
                    border = androidx.compose.foundation.BorderStroke(1.dp, PrimaryBlue)
                ) {
                    Icon(Icons.Filled.Chat, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("NHẮN TIN", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
                Button(
                    onClick = onClick,
                    modifier = Modifier.weight(1f).height(48.dp),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen)
                ) {
                    Icon(Icons.Filled.Phone, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("GỌI ĐIỆN", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }
    }
}
"""
content = re.sub(r'@Composable\nfun ActionBottomBar\(onClick: \(\) -> Unit\) \{.*$', action_bottom_bar_new, content, flags=re.DOTALL)

with open("/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/sos/SosDetailScreen.kt", "w") as f:
    f.write(content)
