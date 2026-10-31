package com.example.bai1.presentation.rescue

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
import com.example.bai1.presentation.components.AppTopBar
import com.example.bai1.ui.theme.*

@Composable
fun RescueMissionListScreen(
    onNavigateToDetail: (String) -> Unit,
    onBottomNavNavigate: (String) -> Unit
) {
    val userRole by DisasterRepository.currentUserRole.collectAsState()
    var selectedTabIndex by remember { mutableIntStateOf(0) }

    val tabs = listOf("Đang diễn ra (5)", "Sắp tới (3)", "Hoàn thành")

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Nhiệm vụ cứu hộ",
                showBackButton = true, // Design has a back button, but it's a bottom nav tab. Let's include it.
                onBackClick = { onBottomNavNavigate("home") } // Back to home
            )
        },
        bottomBar = {
            AppBottomNavigation(
                currentRoute = "mission_list",
                userRole = userRole,
                onNavigate = onBottomNavNavigate
            )
        },
        containerColor = BackgroundLight
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // TabRow
            TabRow(
                selectedTabIndex = selectedTabIndex,
                containerColor = Color.White,
                contentColor = PrimaryBlue,
                divider = { HorizontalDivider(color = BorderColor) }
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTabIndex == index,
                        onClick = { selectedTabIndex = index },
                        text = {
                            Text(
                                text = title,
                                fontWeight = if (selectedTabIndex == index) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 13.sp,
                                color = if (selectedTabIndex == index) PrimaryBlue else TextSecondary
                            )
                        }
                    )
                }
            }

            // Missions List (Mock Data for exact design match)
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    MissionCard(
                        statusText = "Đang thực hiện",
                        statusColor = EmergencyRed,
                        title = "Cứu hộ tại Hòa Tiến",
                        location = "Hòa Vang, Đà Nẵng",
                        people = "6 người",
                        time = "08:00 - 12:00",
                        distance = "Cách 2.3 km",
                        buttonText = "Chi tiết",
                        onButtonClick = { onNavigateToDetail("mock_mission_1") }
                    )
                }
                
                item {
                    MissionCard(
                        statusText = "Chuẩn bị",
                        statusColor = WarningOrange,
                        title = "Hỗ trợ di tản vùng ngập",
                        location = "Điện Bàn, Quảng Nam",
                        people = "20 người",
                        time = "13:00 - 16:00",
                        distance = "Cách 12.1 km",
                        buttonText = "Xem",
                        onButtonClick = {}
                    )
                }

                item {
                    MissionCard(
                        statusText = "Sắp tới",
                        statusColor = PrimaryBlue,
                        title = "Tiếp tế lương thực",
                        location = "Duy Xuyên, Quảng Nam",
                        people = "50 hộ dân",
                        time = "Ngày mai, 08:00",
                        distance = "Cách 28.5 km",
                        buttonText = "Xem",
                        onButtonClick = {}
                    )
                }
            }
        }
    }
}

@Composable
fun MissionCard(
    statusText: String,
    statusColor: Color,
    title: String,
    location: String,
    people: String,
    time: String,
    distance: String,
    buttonText: String,
    onButtonClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp), // Using border instead of elevation for flat design
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
        ) {
            // Left Color Bar
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(statusColor)
            )
            
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(16.dp)
            ) {
                // Status Badge
                Surface(
                    color = statusColor,
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = statusText,
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Title
                Text(
                    text = title,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Info Rows
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.LocationOn, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(location, fontSize = 13.sp, color = TextSecondary)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Home, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(people, fontSize = 13.sp, color = TextSecondary)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.AccessTime, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(time, fontSize = 13.sp, color = TextSecondary)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Person, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(distance, fontSize = 13.sp, color = TextSecondary)
                    }

                    Button(
                        onClick = onButtonClick,
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp),
                        modifier = Modifier.height(36.dp)
                    ) {
                        Text(buttonText, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
