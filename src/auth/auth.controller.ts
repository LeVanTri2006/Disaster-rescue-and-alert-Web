import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);
    return { success: true, data: result };
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const tokens = await this.authService.login(loginDto);
    return { success: true, data: tokens };
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    const tokens = await this.authService.refresh(refreshToken);
    return { success: true, data: tokens };
  }

  @Post('google')
  async googleLogin(@Body('idToken') idToken: string, @Body('role') role?: string) {
    const tokens = await this.authService.googleLogin(idToken, role as any);
    return { success: true, data: tokens };
  }

  @UseGuards(JwtAuthGuard)
  @Post('firebase-token')
  async firebaseToken(@Request() req: any) {
    const customToken = await this.authService.createFirebaseToken(req.user.id, req.user.role);
    return { success: true, data: { customToken } };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: any) {
    return { success: true, data: req.user };
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(forgotPasswordDto);
    return { success: true, data: result };
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(resetPasswordDto);
    return { success: true, data: result };
  }

  @Post('reset-password-firebase')
  async resetPasswordFirebase(@Body() body: { firebaseIdToken: string; newPassword: string }) {
    const result = await this.authService.resetPasswordFirebase(body.firebaseIdToken, body.newPassword);
    return { success: true, data: result };
  }
}
