package com.example.bai1.presentation.map

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.*
import androidx.compose.runtime.*
import android.util.Log
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.bai1.data.model.UserRole
import com.example.bai1.data.repository.DisasterRepository
import com.example.bai1.presentation.components.AppBottomNavigation
import com.example.bai1.presentation.components.TaskCard
import com.example.bai1.sos.domain.SosRescueInfo
import com.example.bai1.sos.domain.SosStatus
import com.example.bai1.sos.domain.SosTransportMode
import com.example.bai1.ui.theme.*
import com.example.bai1.sos.SosAppDependencies
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DisasterMapScreen(
    sosEvents: List<SosRescueInfo> = emptyList(),
    onNavigateToDetail: (String) -> Unit,
    onBottomNavNavigate: (String) -> Unit
) {
    val userRole by DisasterRepository.currentUserRole.collectAsState()
    
    // Fetch active SOS when map opens
    LaunchedEffect(Unit) {
        SosAppDependencies.sosRepository.getActiveSos()
    }

    var selectedSos by remember { mutableStateOf<SosRescueInfo?>(null) }
    val daNang = LatLng(16.0544, 108.2022)
    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(daNang, 12f)
    }
    
    // Filter out only active SOS
    val activeSosEvents = sosEvents.filter { 
        it.status == SosStatus.ACTIVE || it.status == SosStatus.PENDING || it.status == SosStatus.QUEUED 
    }
    
    LaunchedEffect(activeSosEvents) {
        Log.d("MAP_DEBUG", "MAP_DEBUG_ACTIVE_COUNT=${activeSosEvents.size}")
        Log.d("MAP_DEBUG", "MAP_DEBUG_MARKER_COUNT=${activeSosEvents.size}")
    }

    Scaffold(
        bottomBar = {
            AppBottomNavigation(
                currentRoute = "map",
                userRole = userRole,
                onNavigate = onBottomNavNavigate
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
                uiSettings = MapUiSettings(myLocationButtonEnabled = true),
                properties = MapProperties(isMyLocationEnabled = false) // True requires location permissions
            ) {
                activeSosEvents.forEach { sos ->
                    val pos = LatLng(sos.latitude ?: 0.0, sos.longitude ?: 0.0)
                    Marker(
                        state = MarkerState(position = pos),
                        title = "Cứu hộ khẩn cấp: ${sos.urgency.name}",
                        snippet = "Người: ${sos.totalPeople} - ${sos.condition}",
                        onClick = {
                            selectedSos = sos
                            false // return false so info window shows and camera moves
                        }
                    )
                }
            }

            // Overlay top bar
            Surface(
                color = Color.White.copy(alpha = 0.9f),
                shadowElevation = 4.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        "Bản đồ cứu hộ",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        "Hiển thị ${activeSosEvents.size} tín hiệu SOS đang hoạt động",
                        fontSize = 14.sp,
                        color = TextSecondary
                    )
                }
            }

            // Overlay Bottom Sheet for Selected Marker
            selectedSos?.let { sos ->
                Card(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 24.dp, start = 16.dp, end = 16.dp)
                        .fillMaxWidth(),
                    elevation = CardDefaults.cardElevation(8.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.WarningAmber, contentDescription = null, tint = EmergencyRed)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "MỨC ĐỘ KHẨN CẤP: ${sos.urgency.name}",
                                fontWeight = FontWeight.Bold,
                                color = EmergencyRed,
                                fontSize = 16.sp
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        val timeStr = SimpleDateFormat("HH:mm dd/MM", Locale.getDefault()).format(Date(sos.createdAt))
                        Text("Thời gian: $timeStr", fontSize = 14.sp, color = TextPrimary)
                        Text("Người cần cứu: ${sos.adults} lớn, ${sos.children} trẻ, ${sos.elderly} cao tuổi", fontSize = 14.sp, color = TextPrimary)
                        Text("Tình trạng: ${sos.condition}", fontSize = 14.sp, color = TextPrimary)
                        if (sos.neededItems.isNotEmpty()) {
                            Text("Cần hỗ trợ: ${sos.neededItems.joinToString()}", fontSize = 14.sp, color = TextPrimary)
                        }
                        if (sos.description.isNotBlank()) {
                            Text("Mô tả: ${sos.description}", fontSize = 14.sp, color = TextPrimary)
                        }
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { onNavigateToDetail(sos.eventId) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                        ) {
                            Text("XEM CHI TIẾT", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                        
                        Spacer(modifier = Modifier.height(8.dp))
                        TextButton(
                            onClick = { selectedSos = null },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Đóng")
                        }
                    }
                }
            }
        }
    }
}
