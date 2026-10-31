package com.example.bai1.rescue.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.bai1.rescue.network.MissionStatus
import com.example.bai1.rescue.network.RescueMissionResponse
import com.example.bai1.rescue.repository.RescueMissionRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class RescueMissionViewModel(
    private val repository: RescueMissionRepository
) : ViewModel() {

    val missions: StateFlow<List<RescueMissionResponse>> = repository.missions
    val isLoading: StateFlow<Boolean> = repository.isLoading
    val error: StateFlow<String?> = repository.error

    private val _selectedMission = MutableStateFlow<RescueMissionResponse?>(null)
    val selectedMission: StateFlow<RescueMissionResponse?> = _selectedMission.asStateFlow()

    private val _missionActionError = MutableStateFlow<String?>(null)
    val missionActionError: StateFlow<String?> = _missionActionError.asStateFlow()

    fun loadMissions() {
        viewModelScope.launch {
            repository.fetchMyMissions()
        }
    }

    fun loadMissionDetail(id: String) {
        viewModelScope.launch {
            val result = repository.getMissionDetail(id)
            if (result is com.example.bai1.rescue.network.RescueMissionApiResult.Success) {
                _selectedMission.value = result.data
            } else if (result is com.example.bai1.rescue.network.RescueMissionApiResult.Failure) {
                _missionActionError.value = result.error.message
            }
        }
    }

    fun updateMissionStatus(id: String, newStatus: MissionStatus) {
        viewModelScope.launch {
            _missionActionError.value = null
            val result = repository.updateMissionStatus(id, newStatus)
            if (result is com.example.bai1.rescue.network.RescueMissionApiResult.Failure) {
                _missionActionError.value = result.error.message
            } else {
                // Refresh detail if needed
                if (_selectedMission.value?.id == id) {
                    loadMissionDetail(id)
                }
            }
        }
    }
    
    fun clearError() {
        _missionActionError.value = null
    }
}
