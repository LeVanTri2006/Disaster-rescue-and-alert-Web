with open("/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/rescue/repository/RescueMissionRepository.kt", "r") as f:
    content = f.read()

old_func = """    override suspend fun acceptRescueRequest(requestId: String): RescueMissionApiResult<RescueMissionResponse> {
        return apiClient.acceptRescueRequest(requestId)
    }"""

new_func = """    override suspend fun acceptRescueRequest(requestId: String): RescueMissionApiResult<RescueMissionResponse> {
        val result = apiClient.acceptRescueRequest(requestId)
        if (result is RescueMissionApiResult.Success) {
            fetchMyMissions()
        }
        return result
    }"""

content = content.replace(old_func, new_func)

with open("/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/rescue/repository/RescueMissionRepository.kt", "w") as f:
    f.write(content)
