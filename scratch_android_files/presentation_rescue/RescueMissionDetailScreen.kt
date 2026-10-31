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
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import com.example.bai1.rescue.network.MissionStatus
import com.example.bai1.rescue.presentation.RescueMissionViewModel
import com.example.bai1.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MissionDetailScreen(
    missionId: String,
    viewModel: RescueMissionViewModel = androidx.lifecycle.viewmodel.compose.viewModel(
        factory = com.example.bai1.rescue.presentation.RescueMissionViewModelFactory()
    ),
    onNavigateBack: () -> Unit,
    onNavigateToChat: () -> Unit
) {
    val mission by viewModel.selectedMission.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val actionError by viewModel.missionActionError.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(missionId) {
        viewModel.loadMissionDetail(missionId)
    }

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
                    IconButton(onClick = onNavigateBack) {
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
            if (mission?.status != MissionStatus.COMPLETED.name && mission?.status != MissionStatus.CANCELLED.name && mission?.status != MissionStatus.FAILED.name) {
                BottomActionPanel(
                    onCall = {
                        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:0987654321")) // Mock phone
                        context.startActivity(intent)
                    },
                    onChat = onNavigateToChat,
                    onMap = {
                        val lat = mission?.request?.latitude
                        val lng = mission?.request?.longitude
                        if (lat != null && lng != null) {
                            val uri = Uri.parse("google.navigation:q=$lat,$lng")
                            val mapIntent = Intent(Intent.ACTION_VIEW, uri)
                            mapIntent.setPackage("com.google.android.apps.maps")
                            if (mapIntent.resolveActivity(context.packageManager) != null) {
                                context.startActivity(mapIntent)
                            } else {
                                context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                            }
                        }
                    },
                    onAccept = {
                        if (mission?.status == MissionStatus.IN_ROUTE.name) {
                            viewModel.updateMissionStatus(missionId, MissionStatus.IN_PROGRESS)
                        } else if (mission?.status == MissionStatus.IN_PROGRESS.name) {
                            viewModel.updateMissionStatus(missionId, MissionStatus.COMPLETED)
                        } else {
                            viewModel.updateMissionStatus(missionId, MissionStatus.IN_ROUTE)
                        }
                    },
                    buttonText = when (mission?.status) {
                        MissionStatus.IN_ROUTE.name -> "BẮT ĐẦU CỨU HỘ"
                        MissionStatus.IN_PROGRESS.name -> "HOÀN THÀNH"
                        else -> "BẮT ĐẦU DI CHUYỂN"
                    }
                )
            }
        }
    ) { innerPadding ->
        if (isLoading && mission == null) {
            Box(modifier = Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (mission != null) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
                contentPadding = PaddingValues(top = 16.dp, bottom = 100.dp)
            ) {
                if (actionError != null) {
                    item {
                        Text("Lỗi: $actionError", color = EmergencyRed)
                    }
                }
                
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
                                Text(
                                    mission?.request?.urgency ?: "Khẩn cấp", 
                                    color = EmergencyRed, 
                                    fontSize = 12.sp, 
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Icon(Icons.Default.LocationOn, contentDescription = null, tint = PrimaryBlue, modifier = Modifier.size(20.dp).offset(y = 2.dp))
                                Text(
                                    text = if (mission?.request?.latitude != null) "Lat: ${mission?.request?.latitude}, Lng: ${mission?.request?.longitude}" else "Không có vị trí",
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
                        DetailRow(icon = Icons.Default.Groups, label = "Số người cần cứu", value = "${mission?.request?.peopleCount ?: 0} người")
                        DetailRow(icon = Icons.Default.Warning, label = "Trạng thái nhiệm vụ", value = mission?.status ?: "")
                        if (mission?.notes != null) {
                            DetailRow(icon = Icons.Default.MedicalServices, label = "Ghi chú", value = mission?.notes ?: "")
                        }
                        DetailRow(icon = Icons.Default.Phone, label = "Người yêu cầu", value = mission?.request?.requesterId ?: "Không rõ")
                    }
                }

                // Additional Description
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Mô tả", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(BackgroundLight)
                                .padding(16.dp)
                        ) {
                            Text(
                                text = mission?.request?.description ?: "Không có mô tả",
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
    onMap: () -> Unit,
    onAccept: () -> Unit,
    buttonText: String
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
                .padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onCall,
                modifier = Modifier
                    .size(48.dp)
                    .background(PrimaryLightBlue, RoundedCornerShape(12.dp))
            ) {
                Icon(Icons.Default.Phone, contentDescription = "Gọi điện", tint = PrimaryBlue)
            }

            IconButton(
                onClick = onChat,
                modifier = Modifier
                    .size(48.dp)
                    .background(PrimaryLightBlue, RoundedCornerShape(12.dp))
            ) {
                Icon(Icons.Default.ChatBubbleOutline, contentDescription = "Nhắn tin", tint = PrimaryBlue)
            }

            IconButton(
                onClick = onMap,
                modifier = Modifier
                    .size(48.dp)
                    .background(PrimaryLightBlue, RoundedCornerShape(12.dp))
            ) {
                Icon(Icons.Default.Map, contentDescription = "Chỉ đường", tint = PrimaryBlue)
            }

            Button(
                onClick = onAccept,
                modifier = Modifier.weight(1f).height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryBlue)
            ) {
                Text(buttonText, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

