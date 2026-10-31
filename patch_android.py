import os

filepath = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/rescue/presentation/RescueMissionViewModel.kt"

with open(filepath, 'r') as f:
    content = f.read()

target = """    fun loadNearbyRequests(lat: Double, lon: Double, radius: Int = 10000) {
        viewModelScope.launch {
            _missionActionError.value = null
            val result = repository.getNearbyRequests(lat, lon, radius)
            if (result is com.example.bai1.rescue.network.RescueMissionApiResult.Success) {
                _nearbyRequests.value = result.data
            } else if (result is com.example.bai1.rescue.network.RescueMissionApiResult.Failure) {
                _missionActionError.value = result.error.message
            }
        }
    }"""

replacement = """    fun loadNearbyRequests(lat: Double, lon: Double, radius: Int = 10000) {
        viewModelScope.launch {
            _missionActionError.value = null
            val result = repository.getNearbyRequests(lat, lon, radius)
            if (result is com.example.bai1.rescue.network.RescueMissionApiResult.Success) {
                _nearbyRequests.value = result.data.filter { it.status == "PENDING" }
            } else if (result is com.example.bai1.rescue.network.RescueMissionApiResult.Failure) {
                _missionActionError.value = result.error.message
            }
        }
    }"""

if target in content:
    content = content.replace(target, replacement)
    with open(filepath, 'w') as f:
        f.write(content)
    print("PATCH_SUCCESS")
else:
    print("TARGET_NOT_FOUND")

