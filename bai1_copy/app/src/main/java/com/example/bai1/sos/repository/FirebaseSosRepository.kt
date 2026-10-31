package com.example.bai1.sos.repository

import com.example.bai1.sos.domain.SosRescueInfo
import com.example.bai1.sos.domain.SosStatus
import com.example.bai1.sos.domain.SosSubmissionResult
import com.example.bai1.sos.realtime.FirebaseSosChange
import com.example.bai1.sos.realtime.FirebaseSosRealtimeDataSource
import com.example.bai1.sos.realtime.SosRealtimeDataSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class FirebaseSosRepository(
    private val localRepository: SosRepository,
    private val realtimeDataSource: SosRealtimeDataSource,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default),
) : SosRepository {
    private val realtimeEvents = MutableStateFlow<Map<String, SosRescueInfo>>(emptyMap())
    private var realtimeStarted = false

    override suspend fun submitSos(sos: SosRescueInfo): SosSubmissionResult =
        localRepository.submitSos(sos)

    override suspend fun getMySos(): List<SosRescueInfo> = localRepository.getMySos()

    override suspend fun getActiveSos(): List<SosRescueInfo> {
        ensureRealtimeStarted()
        localRepository.getActiveSos() // triggers fetch and saves to local
        return mergedEvents().filter { it.isActive() }
    }

    override fun observeSos(): Flow<List<SosRescueInfo>> {
        ensureRealtimeStarted()
        return combine(localRepository.observeSos(), realtimeEvents) { local, realtime ->
            merge(local, realtime.values.toList())
        }
    }

    override fun observeRealtimeSos(): Flow<List<SosRescueInfo>> {
        ensureRealtimeStarted()
        return realtimeEvents.asStateFlow().map { it.values.toList() }
    }

    override suspend fun getSosById(eventId: String): SosRescueInfo? {
        ensureRealtimeStarted()
        return localRepository.getSosById(eventId) ?: realtimeEvents.value[eventId]
    }

    private fun ensureRealtimeStarted() {
        if (realtimeStarted) return
        realtimeStarted = true
        scope.launch {
            realtimeDataSource.observeChanges().collect { change ->
                realtimeEvents.update { current ->
                    when (change) {
                        is FirebaseSosChange.Upsert -> current + (change.event.eventId to change.event)
                        is FirebaseSosChange.Removed -> current - change.eventId
                    }
                }
            }
        }
    }

    private suspend fun mergedEvents(): List<SosRescueInfo> =
        merge(localRepository.getMySos(), realtimeEvents.value.values.toList())

    private fun merge(local: List<SosRescueInfo>, realtime: List<SosRescueInfo>): List<SosRescueInfo> =
        (local + realtime).associateBy { it.eventId }.values.toList()

    private fun SosRescueInfo.isActive(): Boolean = status == SosStatus.SUBMITTED ||
        status == SosStatus.PENDING || status == SosStatus.QUEUED || status == SosStatus.ACTIVE
}
