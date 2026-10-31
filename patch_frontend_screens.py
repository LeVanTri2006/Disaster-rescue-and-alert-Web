import os

base_dir = "/home/vantri/AndroidStudioProjects/bai1/app/src/main/java/com/example/bai1"
auth_pkg = os.path.join(base_dir, "presentation", "auth")
nav_pkg = os.path.join(base_dir, "presentation", "navigation")

# 1. Update Routes.kt
routes_path = os.path.join(nav_pkg, "Routes.kt")
with open(routes_path, "r") as f:
    routes = f.read()

if "const val RESET_PASSWORD" not in routes:
    routes = routes.replace(
        "const val OTP_VERIFICATION = \"otp_verification\"",
        "const val OTP_VERIFICATION = \"otp_verification/{identifier}\"\n"
        "    const val RESET_PASSWORD = \"reset_password/{identifier}/{otp}\""
    )
    routes = routes.replace(
        "fun missionDetail(missionId: String) = \"mission_detail/$missionId\"",
        "fun missionDetail(missionId: String) = \"mission_detail/$missionId\"\n"
        "    fun otpVerification(identifier: String) = \"otp_verification/$identifier\"\n"
        "    fun resetPassword(identifier: String, otp: String) = \"reset_password/$identifier/$otp\""
    )
    with open(routes_path, "w") as f:
        f.write(routes)

# 2. Update ForgotPasswordScreen.kt
fp_path = os.path.join(auth_pkg, "ForgotPasswordScreen.kt")
fp_content = """package com.example.bai1.presentation.auth

import android.widget.Toast
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.bai1.presentation.components.AppTopBar
import com.example.bai1.presentation.components.PrimaryButton
import com.example.bai1.ui.theme.*
import com.example.bai1.auth.AuthViewModel
import kotlinx.coroutines.launch

@Composable
fun ForgotPasswordScreen(
    authViewModel: AuthViewModel,
    onNavigateBack: () -> Unit,
    onSendCode: (String) -> Unit
) {
    var emailOrPhone by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

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

            Column(modifier = Modifier.fillMaxWidth()) {
                PrimaryButton(
                    text = if (isLoading) "Đang gửi..." else "Gửi mã xác minh",
                    onClick = {
                        if (emailOrPhone.isNotBlank()) {
                            isLoading = true
                            scope.launch {
                                val result = authViewModel.forgotPassword(emailOrPhone)
                                isLoading = false
                                if (result.isSuccess) {
                                    Toast.makeText(context, "Mã OTP đã được gửi", Toast.LENGTH_SHORT).show()
                                    onSendCode(emailOrPhone)
                                } else {
                                    Toast.makeText(context, result.exceptionOrNull()?.message ?: "Lỗi gửi mã", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    },
                    enabled = !isLoading
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
"""
with open(fp_path, "w") as f:
    f.write(fp_content)

# 3. Update OTPScreen.kt
otp_path = os.path.join(auth_pkg, "OTPScreen.kt")
otp_content = """package com.example.bai1.presentation.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.bai1.presentation.components.AppTopBar
import com.example.bai1.presentation.components.PrimaryButton
import com.example.bai1.ui.theme.*

@Composable
fun OTPScreen(
    identifier: String,
    onNavigateBack: () -> Unit,
    onVerifySuccess: (String) -> Unit
) {
    var otpCode by remember { mutableStateOf("") }

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
                    text = "Mã xác thực gồm 6 số đã được gửi đến $identifier.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary,
                    textAlign = TextAlign.Center,
                    lineHeight = 22.sp
                )

                Spacer(modifier = Modifier.height(36.dp))

                OutlinedTextField(
                    value = otpCode,
                    onValueChange = { if (it.length <= 6) otpCode = it },
                    label = { Text("Mã OTP") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(28.dp))
            }

            Column(modifier = Modifier.fillMaxWidth()) {
                PrimaryButton(
                    text = "Xác nhận",
                    onClick = {
                        if (otpCode.length == 6) {
                            onVerifySuccess(otpCode)
                        }
                    },
                    enabled = otpCode.length == 6
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
"""
with open(otp_path, "w") as f:
    f.write(otp_content)

# 4. Create ResetPasswordScreen.kt
reset_path = os.path.join(auth_pkg, "ResetPasswordScreen.kt")
reset_content = """package com.example.bai1.presentation.auth

import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.example.bai1.presentation.components.AppTopBar
import com.example.bai1.presentation.components.PrimaryButton
import com.example.bai1.ui.theme.*
import com.example.bai1.auth.AuthViewModel
import kotlinx.coroutines.launch

@Composable
fun ResetPasswordScreen(
    identifier: String,
    otp: String,
    authViewModel: AuthViewModel,
    onNavigateBack: () -> Unit,
    onResetSuccess: () -> Unit
) {
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

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
                Spacer(modifier = Modifier.height(20.dp))

                Text(
                    text = "Tạo mật khẩu mới",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = TextPrimary
                )

                Spacer(modifier = Modifier.height(32.dp))

                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it },
                    label = { Text("Mật khẩu mới") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextSecondary) },
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = { Text("Xác nhận mật khẩu") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextSecondary) },
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true
                )
            }

            Column(modifier = Modifier.fillMaxWidth()) {
                PrimaryButton(
                    text = if (isLoading) "Đang lưu..." else "Lưu mật khẩu",
                    onClick = {
                        if (newPassword != confirmPassword) {
                            Toast.makeText(context, "Mật khẩu không khớp", Toast.LENGTH_SHORT).show()
                            return@PrimaryButton
                        }
                        if (newPassword.length < 6) {
                            Toast.makeText(context, "Mật khẩu phải từ 6 ký tự", Toast.LENGTH_SHORT).show()
                            return@PrimaryButton
                        }
                        isLoading = true
                        scope.launch {
                            val result = authViewModel.resetPassword(identifier, otp, newPassword)
                            isLoading = false
                            if (result.isSuccess) {
                                Toast.makeText(context, "Đặt lại mật khẩu thành công!", Toast.LENGTH_SHORT).show()
                                onResetSuccess()
                            } else {
                                Toast.makeText(context, result.exceptionOrNull()?.message ?: "Lỗi", Toast.LENGTH_SHORT).show()
                            }
                        }
                    },
                    enabled = !isLoading && newPassword.isNotBlank() && confirmPassword.isNotBlank()
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
"""
with open(reset_path, "w") as f:
    f.write(reset_content)

# 5. Update AppNavGraph.kt
appnav_path = os.path.join(nav_pkg, "AppNavGraph.kt")
with open(appnav_path, "r") as f:
    appnav = f.read()

if "ResetPasswordScreen(" not in appnav:
    appnav = appnav.replace(
        """// 23. Forgot Password Screen
        composable(Routes.FORGOT_PASSWORD) {
            ForgotPasswordScreen(
                onNavigateBack = { navController.popBackStack() },
                onSendCode = { navController.navigate(Routes.OTP_VERIFICATION) }
            )
        }

        // 24. OTP Verification Screen
        composable(Routes.OTP_VERIFICATION) {
            OTPScreen(
                onNavigateBack = { navController.popBackStack() },
                onVerifySuccess = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                }
            )
        }""",
        """// 23. Forgot Password Screen
        composable(Routes.FORGOT_PASSWORD) {
            ForgotPasswordScreen(
                authViewModel = authViewModel,
                onNavigateBack = { navController.popBackStack() },
                onSendCode = { identifier -> navController.navigate(Routes.otpVerification(identifier)) }
            )
        }

        // 24. OTP Verification Screen
        composable(
            route = Routes.OTP_VERIFICATION,
            arguments = listOf(navArgument("identifier") { type = NavType.StringType })
        ) { backStackEntry ->
            val identifier = backStackEntry.arguments?.getString("identifier") ?: ""
            OTPScreen(
                identifier = identifier,
                onNavigateBack = { navController.popBackStack() },
                onVerifySuccess = { otp ->
                    navController.navigate(Routes.resetPassword(identifier, otp))
                }
            )
        }
        
        // 24.5 Reset Password Screen
        composable(
            route = Routes.RESET_PASSWORD,
            arguments = listOf(
                navArgument("identifier") { type = NavType.StringType },
                navArgument("otp") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val identifier = backStackEntry.arguments?.getString("identifier") ?: ""
            val otp = backStackEntry.arguments?.getString("otp") ?: ""
            ResetPasswordScreen(
                identifier = identifier,
                otp = otp,
                authViewModel = authViewModel,
                onNavigateBack = { navController.popBackStack() },
                onResetSuccess = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                }
            )
        }"""
    )
    with open(appnav_path, "w") as f:
        f.write(appnav)

print("UI screens patched.")
