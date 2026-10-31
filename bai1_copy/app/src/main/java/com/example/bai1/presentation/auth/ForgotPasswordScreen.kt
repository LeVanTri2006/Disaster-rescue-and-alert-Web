package com.example.bai1.presentation.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LockReset
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
fun ForgotPasswordScreen(
    onNavigateBack: () -> Unit,
    onSendCode: (String, String?) -> Unit
) {
    var emailOrPhone by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Quên mật khẩu",
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
                Spacer(modifier = Modifier.height(20.dp))

                Box(
                    modifier = Modifier
                        .size(70.dp)
                        .clip(CircleShape)
                        .background(PrimaryLightBlue),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.LockReset,
                        contentDescription = null,
                        tint = PrimaryBlue,
                        modifier = Modifier.size(38.dp)
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Text(
                    text = "Khôi phục mật khẩu",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = TextPrimary
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "Vui lòng nhập email hoặc số điện thoại đã đăng ký để nhận mã xác minh OTP.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary,
                    textAlign = TextAlign.Center,
                    lineHeight = 22.sp
                )

                Spacer(modifier = Modifier.height(32.dp))

                OutlinedTextField(
                    value = emailOrPhone,
                    onValueChange = { emailOrPhone = it },
                    label = { Text("Email hoặc số điện thoại") },
                    leadingIcon = { Icon(Icons.Default.Mail, contentDescription = null, tint = TextSecondary) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true
                )
            }

            val context = androidx.compose.ui.platform.LocalContext.current
            var isLoading by remember { mutableStateOf(false) }

            Column(modifier = Modifier.fillMaxWidth()) {
                PrimaryButton(
                    text = if (isLoading) "Đang gửi..." else "Gửi mã xác minh",
                    onClick = {
                        val input = emailOrPhone.trim()
                        if (input.isBlank()) return@PrimaryButton

                        isLoading = true
                        if (input.contains("@")) {
                            // Email flow handled by viewModel. 
                            // Since we don't have direct access to viewModel here, we'll pass the identifier back up
                            onSendCode(input, null)
                            isLoading = false
                        } else {
                            // Phone flow handled by Firebase
                            val auth = com.google.firebase.auth.FirebaseAuth.getInstance()
                            
                            // Format for Firebase
                            val formattedPhone = if (input.startsWith("0")) "+84${input.substring(1)}" else input

                            val options = com.google.firebase.auth.PhoneAuthOptions.newBuilder(auth)
                                .setPhoneNumber(formattedPhone)
                                .setTimeout(60L, java.util.concurrent.TimeUnit.SECONDS)
                                .setActivity(context as android.app.Activity)
                                .setCallbacks(object : com.google.firebase.auth.PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                                    override fun onVerificationCompleted(credential: com.google.firebase.auth.PhoneAuthCredential) {
                                        // Auto-retrieval completed or instant validation
                                    }

                                    override fun onVerificationFailed(e: com.google.firebase.FirebaseException) {
                                        isLoading = false
                                        android.widget.Toast.makeText(context, "Lỗi gửi SMS: ${e.message}", android.widget.Toast.LENGTH_LONG).show()
                                    }

                                    override fun onCodeSent(
                                        verificationId: String,
                                        token: com.google.firebase.auth.PhoneAuthProvider.ForceResendingToken
                                    ) {
                                        isLoading = false
                                        onSendCode(input, verificationId)
                                    }
                                })
                                .build()

                            com.google.firebase.auth.PhoneAuthProvider.verifyPhoneNumber(options)
                        }
                    }
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
