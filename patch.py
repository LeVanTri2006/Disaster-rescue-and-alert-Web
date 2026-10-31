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

# --- SosRescueRequestViewModel.kt ---
viewModel_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/presentation/sos/SosRescueRequestViewModel.kt"
viewModel_replacements = [
    (
'''    fun updatePhoto(uri: Uri?) {
        _formData.update { it.copy(photoUri = uri) }
        
        // Phase 2A Test logic
        uri?.let {
            viewModelScope.launch {
                android.util.Log.d("FirebaseSosPhotoUploader", "Bắt đầu upload URI: $it")
                val eventId = java.util.UUID.randomUUID().toString()
                val result = photoUploader.uploadSosPhoto(it, eventId)
                if (result.isSuccess) {
                    android.util.Log.d("FirebaseSosPhotoUploader", "Upload thành công! Download URL: ${result.getOrNull()}")
                } else {
                    android.util.Log.e("FirebaseSosPhotoUploader", "Upload thất bại!", result.exceptionOrNull())
                }
            }
        }
    }''',
'''    fun updatePhoto(uri: Uri?) {
        _formData.update { it.copy(photoUri = uri) }
    }'''
    ),
    (
'''        // Begin submission
        _uiState.value = SosUiState.Submitting

        val sos = SosRescueInfo(
            adults = form.adults,
            children = form.children,
            elderly = form.elderly,
            neededItems = form.neededItems,
            condition = conditionString,
            description = form.description,
            photoUri = form.photoUri?.toString(),
            latitude = form.latitude,
            longitude = form.longitude,
            locationAccuracy = form.locationAccuracy,
            locationTimestamp = form.locationTimestamp,
            createdAt = System.currentTimeMillis(),
            batteryPercent = batteryProvider.getBatteryPercent(),
            urgency = calculateUrgency(form.copy(condition = conditionString))
        )

        viewModelScope.launch {
            val result = repository.submitSos(sos)''',
'''        // Begin submission
        _uiState.value = SosUiState.Submitting

        viewModelScope.launch {
            val eventId = java.util.UUID.randomUUID().toString()
            var finalPhotoUrl: String? = null
            
            form.photoUri?.let { localUri ->
                android.util.Log.d("SosRescueRequestViewModel", "Uploading photo URI: $localUri")
                val uploadResult = photoUploader.uploadSosPhoto(localUri, eventId)
                if (uploadResult.isSuccess) {
                    finalPhotoUrl = uploadResult.getOrNull()
                    android.util.Log.d("SosRescueRequestViewModel", "Upload success! URL: $finalPhotoUrl")
                } else {
                    android.util.Log.e("SosRescueRequestViewModel", "Upload failed! SOS will be sent without photo.", uploadResult.exceptionOrNull())
                }
            }

            val sos = SosRescueInfo(
                eventId = eventId,
                adults = form.adults,
                children = form.children,
                elderly = form.elderly,
                neededItems = form.neededItems,
                condition = conditionString,
                description = form.description,
                photoUri = finalPhotoUrl,
                latitude = form.latitude,
                longitude = form.longitude,
                locationAccuracy = form.locationAccuracy,
                locationTimestamp = form.locationTimestamp,
                createdAt = System.currentTimeMillis(),
                batteryPercent = batteryProvider.getBatteryPercent(),
                urgency = calculateUrgency(form.copy(condition = conditionString))
            )

            val result = repository.submitSos(sos)'''
    )
]
update_file(viewModel_path, viewModel_replacements)

# --- SosApiModels.kt ---
apiModels_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/sos/network/SosApiModels.kt"
apiModels_replacements = [
    (
'''    val accuracyMeters: Float?,
    val batteryPercent: Int?,
    val urgency: SosUrgency,
    val timestamp: Long
)''',
'''    val accuracyMeters: Float?,
    val batteryPercent: Int?,
    val urgency: SosUrgency,
    val timestamp: Long,
    val photoUrl: String? = null
)'''
    ),
    (
'''    val status: String,
    val urgency: SosUrgency,
    val transportMode: SosTransportMode
) {''',
'''    val status: String,
    val urgency: SosUrgency,
    val transportMode: SosTransportMode,
    val photoUrl: String? = null
) {'''
    ),
    (
'''        batteryPercent = batteryPercent ?: -1,
        urgency = urgency,
        status = runCatching { SosStatus.valueOf(status) }.getOrDefault(SosStatus.PENDING),
        transportMode = transportMode
    )''',
'''        batteryPercent = batteryPercent ?: -1,
        urgency = urgency,
        status = runCatching { SosStatus.valueOf(status) }.getOrDefault(SosStatus.PENDING),
        transportMode = transportMode,
        photoUri = photoUrl
    )'''
    )
]
update_file(apiModels_path, apiModels_replacements)

# --- ApiSosTransport.kt ---
transport_path = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1/sos/transport/ApiSosTransport.kt"
transport_replacements = [
    (
'''        accuracyMeters = locationAccuracy,
        batteryPercent = batteryPercent.takeIf { it in 0..100 },
        urgency = urgency,
        timestamp = createdAt
    )''',
'''        accuracyMeters = locationAccuracy,
        batteryPercent = batteryPercent.takeIf { it in 0..100 },
        urgency = urgency,
        timestamp = createdAt,
        photoUrl = photoUri
    )'''
    )
]
update_file(transport_path, transport_replacements)

