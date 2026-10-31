package com.example.bai1.presentation.map

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.WarningAmber
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.bai1.data.repository.DisasterRepository
import com.example.bai1.presentation.components.AppBottomNavigation
import com.example.bai1.presentation.components.MapMockupCanvas
import com.example.bai1.presentation.components.TaskCard
import com.example.bai1.sos.domain.SosRescueInfo
import com.example.bai1.sos.domain.SosStatus
import com.example.bai1.sos.domain.SosTransportMode
import com.example.bai1.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Disaster Map screen.
 *
 * SOS markers are provided via [sosEvents] — a reactive list from [SosRepository.observeSos()].
 * The screen does NOT read MockSosSharedState directly anymore.
 *
 * @param sosEvents     active SOS events to display as markers (from repository)
 * @param onNavigateToDetail called when a map marker is tapped
 * @param onBottomNavNavigate bottom nav handler
 */
@Composable
fun DisasterMapScreen(
    sosEvents: List<SosRescueInfo> = emptyList(),
    onNavigateToDetail: (String) -> Unit,
    onBottomNavNavigate: (String) -> Unit
) {
    val userRole by DisasterRepository.currentUserRole.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Tất cả", "Cần cứu hộ", "Cần di tản", "Cần y tế")

    Scaffold(
        bottomBar = {
            AppBottomNavigation(
                currentRoute = "map",
                userRole = userRole,
                onNavigate = onBottomNavNavigate
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Full screen vector canvas map
            MapMockupCanvas(
                modifier = Modifier.fillMaxSize(),
                isMiniMap = false,
                showLegend = false,
                onMarkerClick = onNavigateToDetail
            )

            // Top Overlay (Search + Tabs)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .padding(top = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Search Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = { Text("Tìm địa điểm, khu vực...", color = TextSecondary) },
                        leadingIcon = {
                            Icon(Icons.Default.Search, contentDescription = "Tìm kiếm", tint = TextSecondary)
                        },
                        modifier = Modifier
                            .weight(1f)
                            .shadow(4.dp, RoundedCornerShape(24.dp)),
                        shape = RoundedCornerShape(24.dp),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White,
                            focusedBorderColor = PrimaryBlue,
                            unfocusedBorderColor = Color.Transparent
                        )
                    )

                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .shadow(4.dp, CircleShape)
                            .clip(CircleShape)
                            .background(Color.White),
                        contentAlignment = Alignment.Center
                    ) {
                        IconButton(onClick = {}) {
                            Icon(
                                imageVector = Icons.Default.FilterList,
                                contentDescription = "Bộ lọc",
                                tint = TextPrimary
                            )
                        }
                    }
                }

                // Scrollable TabRow
                ScrollableTabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = Color.Transparent,
                    contentColor = PrimaryBlue,
                    edgePadding = 16.dp,
                    indicator = { },
                    divider = { }
                ) {
                    tabs.forEachIndexed { index, title ->
                        val isSelected = selectedTab == index
                        Tab(
                            selected = isSelected,
                            onClick = { selectedTab = index },
                            modifier = Modifier.padding(end = 8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(if (isSelected) PrimaryBlue else Color.White)
                                    .border(
                                        width = 1.dp,
                                        color = if (isSelected) PrimaryBlue else BorderColor,
                                        shape = RoundedCornerShape(20.dp)
                                    )
                                    .padding(horizontal = 16.dp, vertical = 8.dp)
                            ) {
                                Text(
                                    text = title,
                                    color = if (isSelected) Color.White else TextPrimary,
                                    fontSize = 14.sp,
                                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }

            // SOS Markers — from repository (no longer from MockSosSharedState)
            // Show the most recent active SOS event as a map overlay
            val activeSos = sosEvents.filter {
                it.status == SosStatus.SUBMITTED || it.status == SosStatus.QUEUED || it.status == SosStatus.PENDING || it.status == SosStatus.ACTIVE
            }.lastOrNull()

            if (activeSos != null) {
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .offset(y = (-40).dp)
                        .padding(bottom = 8.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(8.dp),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.padding(bottom = 8.dp).widthIn(max = 260.dp)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                // Status label based on SOS state
                                val statusText = when (activeSos.status) {
                                    SosStatus.SUBMITTED -> "Đã gửi yêu cầu cứu hộ"
                                    SosStatus.QUEUED    -> "Đang chờ kết nối"
                                    SosStatus.PENDING   -> "Đang gửi..."
                                    SosStatus.FAILED    -> "Gửi thất bại"
                                    SosStatus.ACTIVE    -> "Đang hoạt động"
                                    SosStatus.RESOLVED  -> "Đã giải quyết"
                                    SosStatus.FALSE_ALARM -> "Báo động giả"
                                }
                                Text(
                                    statusText,
                                    fontWeight = FontWeight.Bold,
                                    color = when (activeSos.status) {
                                        SosStatus.QUEUED -> Color(0xFFF59E0B)
                                        SosStatus.FAILED -> Color.Gray
                                        else             -> EmergencyRed
                                    },
                                    fontSize = 14.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    "Số người: ${activeSos.totalPeople} · ${activeSos.condition}",
                                    fontSize = 12.sp
                                )
                                Text(
                                    "Mức độ: ${activeSos.urgency.label}",
                                    fontSize = 12.sp,
                                    color = EmergencyRed,
                                    fontWeight = FontWeight.SemiBold
                                )
                                if (activeSos.latitude != null && activeSos.longitude != null) {
                                    Text(
                                        "GPS: ${"%.5f".format(Locale.US, activeSos.latitude)}, " +
                                            "${"%.5f".format(Locale.US, activeSos.longitude)}",
                                        fontSize = 11.sp,
                                        color = TextSecondary
                                    )
                                }
                                if (activeSos.neededItems.isNotEmpty()) {
                                    Text(
                                        "Cần: ${activeSos.neededItems.joinToString()}",
                                        fontSize = 12.sp,
                                        color = TextSecondary
                                    )
                                }
                                // Time
                                val timeStr = SimpleDateFormat("HH:mm", Locale.getDefault())
                                    .format(Date(activeSos.createdAt))
                                Text(timeStr, fontSize = 11.sp, color = Color.LightGray)
                                // Transport mode
                                val transportLabel = when (activeSos.transportMode) {
                                    SosTransportMode.ONLINE  -> "📡 Internet"
                                    SosTransportMode.MESH    -> "📶 Mesh"
                                    SosTransportMode.RELAY   -> "🔗 Relay"
                                    SosTransportMode.UNKNOWN -> "⏳ Đang xử lý"
                                }
                                Text(transportLabel, fontSize = 11.sp, color = Color.Gray)
                            }
                        }
                        // Red emergency marker pin
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(EmergencyRed)
                                .border(3.dp, Color.White, CircleShape)
                        )
                    }
                }
            }

            // Bottom Overlay (Nearest Request Card)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 24.dp)
            ) {
                Text(
                    text = "Yêu cầu cứu hộ gần nhất",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 12.dp)
                )

                TaskCard(
                    title = "Cần cứu hộ khẩn cấp",
                    location = "Hòa Tiến, Đà Nẵng",
                    details = "2.3 km - 6 người",
                    alertColor = EmergencyRed,
                    alertBgColor = EmergencyRedLight,
                    badgeText = "Khẩn cấp",
                    timeAgo = "5 phút trước",
                    icon = Icons.Default.WarningAmber,
                    modifier = Modifier.padding(horizontal = 0.dp)
                )
            }
        }
    }
}
