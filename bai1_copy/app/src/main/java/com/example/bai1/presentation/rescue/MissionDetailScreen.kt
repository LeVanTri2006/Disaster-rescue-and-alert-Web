package com.example.bai1.presentation.rescue

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.bai1.R
import com.example.bai1.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MissionDetailScreen(
    missionId: String,
    onNavigateBack: () -> Unit,
    onNavigateToChat: () -> Unit
) {
    var selectedTabIndex by remember { mutableIntStateOf(0) }
    val tabs = listOf("Tổng quan", "Đội tham gia", "Cập nhật")

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Chi tiết nhiệm vụ", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = Color.White)
            )
        },
        bottomBar = {
            Surface(
                modifier = Modifier.fillMaxWidth().shadow(elevation = 16.dp),
                color = Color.White
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp).navigationBarsPadding(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = {},
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
                    ) {
                        Text("Cập nhật trạng thái", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                    
                    OutlinedButton(
                        onClick = {},
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = PrimaryBlue),
                        border = BorderStroke(1.dp, PrimaryBlue)
                    ) {
                        Text("Hoàn thành nhiệm vụ", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        },
        containerColor = Color.White
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(innerPadding),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            // Header
            item {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            color = EmergencyRed,
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
                                Icon(Icons.Default.Circle, contentDescription = null, tint = Color.White, modifier = Modifier.size(8.dp).padding(end = 4.dp))
                                Text("Đang thực hiện", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        
                        Surface(
                            color = WarningOrangeLight,
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Ưu tiên cao", color = WarningOrange, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "Cứu hộ tại Hòa Tiến",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.LocationOn, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Hòa Tiến, Hòa Vang, Đà Nẵng", fontSize = 14.sp, color = TextSecondary)
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.AccessTime, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("08:00 - 12:00 (Hôm nay)", fontSize = 14.sp, color = TextSecondary)
                    }
                }
            }

            // TabRow
            item {
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
            }

            // Tab Content
            if (selectedTabIndex == 0) {
                item {
                    Column(modifier = Modifier.padding(16.dp)) {
                        // Map Snippet
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(160.dp)
                                .clip(RoundedCornerShape(16.dp))
                        ) {
                            Image(
                                painter = painterResource(id = R.drawable.news_storm), // Placeholder map
                                contentDescription = "Map route",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                            Button(
                                onClick = {},
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue),
                                modifier = Modifier.align(Alignment.BottomEnd).padding(12.dp).height(36.dp),
                                contentPadding = PaddingValues(horizontal = 16.dp)
                            ) {
                                Text("Chỉ đường", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                            }
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        // Mục tiêu
                        Text("Mục tiêu", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Tiếp cận và đưa 6 người dân bị mắc kẹt đến nơi an toàn.",
                            fontSize = 14.sp,
                            color = TextSecondary,
                            lineHeight = 20.sp
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        // Thông tin
                        Text("Thông tin", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Spacer(modifier = Modifier.height(8.dp))
                        BulletList(
                            items = listOf(
                                "Số người: 6 (2 trẻ em, 1 người già)",
                                "Loại thiên tai: Ngập lụt",
                                "Mức độ nguy hiểm: Cao",
                                "Nhu cầu đặc biệt: Cần thuyền, y tế"
                            )
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        // Action buttons
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            OutlinedButton(
                                onClick = {},
                                modifier = Modifier.weight(1f).height(44.dp),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PrimaryBlue),
                                border = BorderStroke(1.dp, PrimaryBlue)
                            ) {
                                Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Gọi", fontWeight = FontWeight.SemiBold)
                            }

                            OutlinedButton(
                                onClick = onNavigateToChat,
                                modifier = Modifier.weight(1f).height(44.dp),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = PrimaryBlue),
                                border = BorderStroke(1.dp, PrimaryBlue)
                            ) {
                                Icon(Icons.Default.ChatBubbleOutline, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Chat nhóm", fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun BulletList(items: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        items.forEach { item ->
            Row(verticalAlignment = Alignment.Top) {
                Text("•", fontSize = 16.sp, color = TextPrimary, modifier = Modifier.padding(end = 8.dp))
                Text(text = item, fontSize = 14.sp, color = TextPrimary, lineHeight = 20.sp)
            }
        }
    }
}
