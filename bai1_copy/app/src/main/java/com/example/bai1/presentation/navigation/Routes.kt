package com.example.bai1.presentation.navigation

object Routes {
    const val SPLASH = "splash"
    const val ONBOARDING = "onboarding"
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val ROLE_SELECTION = "role_selection"
    const val HOME = "home"
    const val MAP = "map"
    const val WARNING_LIST = "warning_list"
    const val STORM_DETAIL = "storm_detail"
    const val FLOOD_DETAIL = "flood_detail"
    const val VOLUNTEER_REGISTER = "volunteer_register"
    const val MISSION_LIST = "mission_list"
    const val MISSION_DETAIL = "mission_detail/{missionId}"
    const val RESCUE_CHAT = "rescue_chat"
    const val SOS = "sos"
    const val SOS_RESCUE_REQUEST = "sos_rescue_request"
    const val NOTIFICATION = "notification"
    const val PROFILE = "profile"
    const val SETTINGS = "settings"
    const val FORGOT_PASSWORD = "forgot_password"
    const val OTP_VERIFICATION = "otp_verification/{identifier}?verificationId={verificationId}"
    const val RESET_PASSWORD = "reset_password/{identifier}?verificationId={verificationId}&otp={otp}"
    const val ABOUT_APP = "about_app"
    const val GROUP_LIST = "group_list"
    const val GROUP_CHAT = "group_chat"

    fun missionDetail(missionId: String) = "mission_detail/$missionId"
    fun otpVerification(identifier: String, verificationId: String? = null) = 
        "otp_verification/${android.net.Uri.encode(identifier)}" + (verificationId?.let { "?verificationId=${android.net.Uri.encode(it)}" } ?: "")
    fun resetPassword(identifier: String, otp: String, verificationId: String? = null) = 
        "reset_password/${android.net.Uri.encode(identifier)}?otp=${android.net.Uri.encode(otp)}" + (verificationId?.let { "&verificationId=${android.net.Uri.encode(it)}" } ?: "")
}
