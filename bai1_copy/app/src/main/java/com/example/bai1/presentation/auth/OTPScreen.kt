package com.example.bai1.presentation.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.bai1.presentation.components.AppTopBar
import com.example.bai1.presentation.components.PrimaryButton
import com.example.bai1.ui.theme.*

@Composable
fun OTPScreen(
    identifier: String,
    verificationId: String?,
    authViewModel: com.example.bai1.auth.AuthViewModel,
    onNavigateBack: () -> Unit,
    onVerifySuccess: (String) -> Unit
) {
    var otpCode by remember { mutableStateOf("") }
    
    // Focus Requester to invisible text field
    val focusRequester = remember { androidx.compose.ui.focus.FocusRequester() }
    
    // Request focus on start
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(100)
        focusRequester.requestFocus()
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Xác thực OTP",
                showBackButton = true,
                onBackClick = onNavigateBack
            )
        },
        containerColor = Color.White
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "Nhập mã xác thực",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = TextPrimary
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "Mã xác thực gồm 6 số đã được gửi đến:\n$identifier",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary,
                    textAlign = TextAlign.Center,
                    lineHeight = 22.sp
                )

                Spacer(modifier = Modifier.height(36.dp))

                // Invisible TextField to handle input
                Box {
                    androidx.compose.foundation.text.BasicTextField(
                        value = otpCode,
                        onValueChange = { if (it.length <= 6 && it.all { char -> char.isDigit() }) otpCode = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .androidx.compose.ui.focus.focusRequester(focusRequester)
                            .androidx.compose.ui.draw.alpha(0f),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        )
                    )
                    
                    // 6 Boxes UI
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        repeat(6) { index ->
                            val char = otpCode.getOrNull(index)?.toString() ?: ""
                            val isFocused = index == otpCode.length || (index == 5 && otpCode.length == 6)
                            
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .border(
                                        width = if (isFocused) 2.dp else 1.5.dp, 
                                        color = if (isFocused) PrimaryBlue else if (char.isNotEmpty()) PrimaryBlue else BorderColor, 
                                        shape = RoundedCornerShape(12.dp)
                                    )
                                    .background(Color(0xFFF8FAFC)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = char,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(28.dp))

                Text(
                    text = "Gửi lại mã sau 45s",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextMuted
                )
            }

            Column(modifier = Modifier.fillMaxWidth()) {
                val context = androidx.compose.ui.platform.LocalContext.current
                var isLoading by remember { mutableStateOf(false) }

                PrimaryButton(
                    text = if (isLoading) "Đang xác thực..." else "Xác nhận",
                    onClick = { 
                        if (otpCode.length == 6) {
                            if (verificationId != null) {
                                // Phone flow: exchange SMS code for Firebase credential
                                isLoading = true
                                val credential = com.google.firebase.auth.PhoneAuthProvider.getCredential(verificationId, otpCode)
                                com.google.firebase.auth.FirebaseAuth.getInstance().signInWithCredential(credential)
                                    .addOnCompleteListener { task ->
                                        if (task.isSuccessful) {
                                            task.result?.user?.getIdToken(true)?.addOnCompleteListener { tokenTask ->
                                                isLoading = false
                                                if (tokenTask.isSuccessful) {
                                                    val token = tokenTask.result?.token ?: ""
                                                    onVerifySuccess(token)
                                                } else {
                                                    android.widget.Toast.makeText(context, "Lỗi lấy token", android.widget.Toast.LENGTH_SHORT).show()
                                                }
                                            }
                                        } else {
                                            isLoading = false
                                            android.widget.Toast.makeText(context, "Mã xác thực không hợp lệ", android.widget.Toast.LENGTH_SHORT).show()
                                        }
                                    }
                            } else {
                                // Email flow: Verify OTP with backend before proceeding
                                isLoading = true
                                authViewModel.verifyOtp(identifier, otpCode) { result ->
                                    isLoading = false
                                    if (result.isSuccess) {
                                        onVerifySuccess(otpCode) 
                                    } else {
                                        android.widget.Toast.makeText(context, result.exceptionOrNull()?.message ?: "Mã xác thực không hợp lệ", android.widget.Toast.LENGTH_SHORT).show()
                                    }
                                }
                            }
                        }
                    }
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
