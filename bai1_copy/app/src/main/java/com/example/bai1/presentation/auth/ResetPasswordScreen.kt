package com.example.bai1.presentation.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.bai1.auth.AuthViewModel
import com.example.bai1.presentation.components.AppTopBar
import com.example.bai1.presentation.components.PrimaryButton
import com.example.bai1.ui.theme.*

@Composable
fun ResetPasswordScreen(
    identifier: String,
    otp: String,
    verificationId: String?,
    authViewModel: AuthViewModel,
    onNavigateBack: () -> Unit,
    onResetSuccess: () -> Unit
) {
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Đặt lại mật khẩu",
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
                    text = "Tạo mật khẩu mới",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = TextPrimary
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "Vui lòng tạo mật khẩu mới an toàn để bảo vệ tài khoản của bạn.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary,
                    textAlign = TextAlign.Center,
                    lineHeight = 22.sp
                )

                Spacer(modifier = Modifier.height(32.dp))

                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it; errorMessage = null },
                    label = { Text("Mật khẩu mới") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextSecondary) },
                    trailingIcon = {
                        val image = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(imageVector = image, contentDescription = null, tint = TextSecondary)
                        }
                    },
                    visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it; errorMessage = null },
                    label = { Text("Nhập lại mật khẩu mới") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextSecondary) },
                    trailingIcon = {
                        val image = if (confirmPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff
                        IconButton(onClick = { confirmPasswordVisible = !confirmPasswordVisible }) {
                            Icon(imageVector = image, contentDescription = null, tint = TextSecondary)
                        }
                    },
                    visualTransformation = if (confirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true
                )

                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = errorMessage!!,
                        color = Color.Red,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }

            Column(modifier = Modifier.fillMaxWidth()) {
                PrimaryButton(
                    text = if (isLoading) "Đang xử lý..." else "Đổi mật khẩu",
                    onClick = {
                        if (newPassword.isBlank() || confirmPassword.isBlank()) {
                            errorMessage = "Vui lòng nhập đầy đủ thông tin"
                            return@PrimaryButton
                        }
                        if (newPassword != confirmPassword) {
                            errorMessage = "Mật khẩu không khớp"
                            return@PrimaryButton
                        }
                        
                        isLoading = true
                        
                        if (verificationId == null) {
                            // Email flow
                            authViewModel.resetPassword(identifier, otp, newPassword) { result ->
                                isLoading = false
                                if (result.isSuccess) {
                                    onResetSuccess()
                                } else {
                                    errorMessage = result.exceptionOrNull()?.message ?: "Có lỗi xảy ra"
                                }
                            }
                        } else {
                            // Phone flow - we use the OTP string which is actually the Firebase ID Token if successful
                            // Wait, the phone flow returns the ID token in OTPScreen or not?
                            // Ah! I need to exchange the SMS code for a Firebase Token in OTPScreen and pass the token as the OTP!
                            authViewModel.resetPasswordFirebase(otp, newPassword) { result ->
                                isLoading = false
                                if (result.isSuccess) {
                                    onResetSuccess()
                                } else {
                                    errorMessage = result.exceptionOrNull()?.message ?: "Có lỗi xảy ra"
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
