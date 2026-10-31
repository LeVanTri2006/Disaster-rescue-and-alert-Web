package com.example.bai1.presentation.rescue

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.bai1.R
import com.example.bai1.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RescueMissionDetailScreen(
    missionId: String,
    onBack: () -> Unit,
    onAcceptMission: () -> Unit,
    onNavigateToChat: () -> Unit
) {
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        "Chi tiết yêu cầu",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = {}) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Menu", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color.White
                )
            )
        },
        containerColor = Color.White,
        bottomBar = {
            BottomActionPanel(
                onCall = {},
                onChat = onNavigateToChat,
                onAccept = onAcceptMission
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
            contentPadding = PaddingValues(top = 16.dp, bottom = 100.dp)
        ) {
            // Header Info
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(EmergencyRedLight)
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text("Khẩn cấp", color = EmergencyRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.LocationOn, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(20.dp).offset(y = 2.dp))
                            Text(
                                text = "Số 123, đường A, phường Hòa Tiến, huyện Hòa Vang, TP. Đà Nẵng",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary,
                                lineHeight = 22.sp
                            )
                        }
                    }
                }
            }

            // Detail List
            item {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    DetailRow(icon = Icons.Default.Groups, label = "Số người cần cứu", value = "6 người (2 trẻ em, 1 người già)")
                    DetailRow(icon = Icons.Default.Flood, label = "Loại thiên tai", value = "Lụt lội")
                    DetailRow(icon = Icons.Default.Warning, label = "Mức độ nguy hiểm", value = "Nước dâng cao, kẹt trên mái nhà")
                    DetailRow(icon = Icons.Default.MedicalServices, label = "Nhu cầu đặc biệt", value = "Cần thuốc trợ tim, thuyền cứu hộ")
                    DetailRow(icon = Icons.Default.Phone, label = "Liên hệ", value = "Chị Lan - 0987.654.321")
                }
            }

            // Additional Description
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Mô tả thêm", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(BackgroundLight)
                            .padding(16.dp)
                    ) {
                        Text(
                            text = "Nước đã ngập ngang tầng 1, đồ đạc đã hư hỏng. Cả nhà đang ở trên gác xép chờ được cứu. Xin hãy đến nhanh!",
                            fontSize = 14.sp,
                            color = TextSecondary,
                            lineHeight = 20.sp
                        )
                    }
                }
            }

            // Images / Map snippet
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(140.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.news_flood),
                        contentDescription = "Hình ảnh hiện trường",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(12.dp))
                    )
                    Image(
                        painter = painterResource(id = R.drawable.news_storm), // Placeholder for mini map snippet
                        contentDescription = "Bản đồ",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(12.dp))
                    )
                }
            }
        }
    }
}

@Composable
private fun DetailRow(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(PrimaryLightBlue),
            contentAlignment = Alignment.Center
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(18.dp))
        }
        Column {
            Text(text = label, fontSize = 12.sp, color = TextSecondary)
            Spacer(modifier = Modifier.height(2.dp))
            Text(text = value, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
        }
    }
}

@Composable
private fun BottomActionPanel(
    onCall: () -> Unit,
    onChat: () -> Unit,
    onAccept: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(elevation = 16.dp),
        color = Color.White
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedButton(
                onClick = onCall,
                modifier = Modifier.weight(0.2f).height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = PrimaryBlue),
                border = androidx.compose.foundation.BorderStroke(1.dp, PrimaryBlue),
                contentPadding = PaddingValues(0.dp)
            ) {
                Icon(Icons.Default.Phone, contentDescription = "Gọi điện", modifier = Modifier.size(20.dp))
            }

            OutlinedButton(
                onClick = onChat,
                modifier = Modifier.weight(0.2f).height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = PrimaryBlue),
                border = androidx.compose.foundation.BorderStroke(1.dp, PrimaryBlue),
                contentPadding = PaddingValues(0.dp)
            ) {
                Icon(Icons.Default.ChatBubbleOutline, contentDescription = "Nhắn tin", modifier = Modifier.size(20.dp))
            }

            Button(
                onClick = onAccept,
                modifier = Modifier.weight(0.6f).height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
            ) {
                Text("Nhận nhiệm vụ", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}
