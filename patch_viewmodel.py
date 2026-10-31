import re

with open("/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/rescue/presentation/RescueMissionViewModel.kt", "r") as f:
    content = f.read()

# Add isCompleting state
if "val isCompleting" not in content:
    state_decl = """    private val _missionActionError = MutableStateFlow<String?>(null)
    val missionActionError: StateFlow<String?> = _missionActionError.asStateFlow()

    private val _isCompleting = MutableStateFlow(false)
    val isCompleting: StateFlow<Boolean> = _isCompleting.asStateFlow()"""
    content = re.sub(r'    private val _missionActionError = MutableStateFlow<String\?>\(null\)\n    val missionActionError: StateFlow<String\?> = _missionActionError.asStateFlow\(\)', state_decl, content)

# Update completeMission
old_func = """    fun completeMission(missionId: String) {
        viewModelScope.launch {
            _missionActionError.value = null
            val result = repository.updateMissionStatus(missionId, MissionStatus.COMPLETED)
            if (result is com.example.bai1.rescue.network.RescueMissionApiResult.Success) {
                _selectedMission.value = result.data
            } else if (result is com.example.bai1.rescue.network.RescueMissionApiResult.Failure) {
                _missionActionError.value = result.error.message
            }
        }
    }"""

new_func = """    fun completeMission(missionId: String) {
        if (_isCompleting.value) return
        viewModelScope.launch {
            _isCompleting.value = true
            _missionActionError.value = null
            val result = repository.updateMissionStatus(missionId, MissionStatus.COMPLETED)
            if (result is com.example.bai1.rescue.network.RescueMissionApiResult.Success) {
                _selectedMission.value = result.data
            } else if (result is com.example.bai1.rescue.network.RescueMissionApiResult.Failure) {
                _missionActionError.value = result.error.message
            }
            _isCompleting.value = false
        }
    }
    
    fun clearMissionActionError() {
        _missionActionError.value = null
    }"""

content = content.replace(old_func, new_func)

with open("/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/rescue/presentation/RescueMissionViewModel.kt", "w") as f:
    f.write(content)
