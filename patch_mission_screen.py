import re

with open("/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/rescue/MissionDetailScreen.kt", "r") as f:
    content = f.read()

if "import androidx.compose.ui.text.style.TextAlign" not in content:
    content = content.replace("import androidx.compose.ui.text.font.FontWeight", "import androidx.compose.ui.text.font.FontWeight\nimport androidx.compose.ui.text.style.TextAlign")

# 1. State extraction
state_injection = """    val selectedMission by viewModel.selectedMission.collectAsState()
    val isCompleting by viewModel.isCompleting.collectAsState()
    val missionActionError by viewModel.missionActionError.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(missionActionError) {
        if (missionActionError != null) {
            snackbarHostState.showSnackbar(missionActionError!!)
            viewModel.clearMissionActionError()
        }
    }"""
content = re.sub(r'    val selectedMission by viewModel\.selectedMission\.collectAsState\(\)', state_injection, content)

# 2. Add SnackbarHost
scaffold_start = r'    Scaffold\('
scaffold_new = """    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },"""
content = re.sub(scaffold_start, scaffold_new, content)

# 3. Bottom bar replace
bottom_bar_old = r'        bottomBar = \{.*?        \},\n        containerColor = Color\.White'
bottom_bar_new = """        bottomBar = {
            Surface(
                modifier = Modifier.fillMaxWidth().shadow(elevation = 16.dp),
                color = Color.White
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp).navigationBarsPadding(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (selectedMission?.status != MissionStatus.COMPLETED.name) {
                        Button(
                            onClick = { viewModel.completeMission(missionId) },
                            enabled = !isCompleting,
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            if (isCompleting) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                            } else {
                                Text("Hoàn thành nhiệm vụ", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    } else {
                        Text(
                            text = "Đã hoàn thành",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = SuccessGreen,
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        },
        containerColor = Color.White"""
content = re.sub(bottom_bar_old, bottom_bar_new, content, flags=re.DOTALL)

# 4. padding change
padding_old = r'contentPadding = PaddingValues\(bottom = if \(selectedMission\?\.status != MissionStatus\.COMPLETED\.name\) 80\.dp else 24\.dp\)'
padding_new = r'contentPadding = PaddingValues(bottom = 80.dp)'
content = re.sub(padding_old, padding_new, content)

with open("/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/rescue/MissionDetailScreen.kt", "w") as f:
    f.write(content)
